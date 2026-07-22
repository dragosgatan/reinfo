"""Async client for the Piston code execution sandbox API."""

from dataclasses import dataclass

import httpx

from app.config import settings
from app.languages import LANGUAGES_BY_SLUG, STABLE_LANGUAGES

LANGUAGE_MAP: dict[str, str] = {lang.slug: lang.piston_language for lang in STABLE_LANGUAGES}
SUPPORTED_LANGUAGES: frozenset[str] = frozenset(LANGUAGE_MAP)
_FILE_NAMES: dict[str, str] = {lang.slug: lang.file_name for lang in STABLE_LANGUAGES}

# Matches PISTON_RUN_TIMEOUT in docker-compose(.prod).yml - clamps our own request so a
# problem's time limit combined with a slow-language multiplier can never trigger a hard
# 400 from Piston (it would just fail the submission) instead of a graceful TLE.
_MAX_RUN_TIMEOUT_MS = 15_000
_COMPILE_TIMEOUT_MS = 30_000


@dataclass
class ExecutionResult:
    stdout: str
    stderr: str
    exit_code: int
    compile_error: bool
    time_ms: int
    memory_kb: int
    timed_out: bool


async def execute(
    language: str,
    code: str,
    stdin: str,
    time_limit_ms: int,
    memory_limit_kb: int,
) -> ExecutionResult:
    """Execute code in the Piston sandbox and return structured results.

    time_limit_ms is the problem's own limit; it gets scaled by the language's
    time_limit_multiplier (e.g. Python/Java run slower than C++) before being sent
    to Piston, and TLE detection uses that same scaled value.

    Raises RuntimeError on HTTP or network errors.
    """
    spec = LANGUAGES_BY_SLUG.get(language)
    piston_lang = spec.piston_language if spec else language
    piston_version = spec.version if spec else "*"
    filename = spec.file_name if spec else "main.txt"
    multiplier = spec.time_limit_multiplier if spec else 1.0
    effective_time_limit_ms = min(int(time_limit_ms * multiplier), _MAX_RUN_TIMEOUT_MS)

    payload = {
        "language": piston_lang,
        "version": piston_version,
        "files": [{"name": filename, "content": code}],
        "stdin": stdin,
        "run_timeout": effective_time_limit_ms,
        "compile_timeout": _COMPILE_TIMEOUT_MS,
        "run_memory_limit": memory_limit_kb * 1024,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(f"{settings.piston_url}/api/v2/execute", json=payload)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Piston request failed: {exc}") from exc

    data = resp.json()
    run = data.get("run", {})
    compile_ = data.get("compile")

    compile_error = compile_ is not None and (compile_.get("code") or 0) != 0

    raw_time = run.get("time") or 0.0
    time_ms = int(raw_time * 1000)
    memory_bytes = run.get("memory") or 0
    memory_kb = memory_bytes // 1024

    timed_out = run.get("signal") == "SIGKILL" and time_ms >= effective_time_limit_ms * 0.9

    return ExecutionResult(
        stdout=run.get("stdout") or "",
        stderr=run.get("stderr") or "",
        exit_code=(run.get("code") or 0),
        compile_error=compile_error,
        time_ms=time_ms,
        memory_kb=memory_kb,
        timed_out=timed_out,
    )
