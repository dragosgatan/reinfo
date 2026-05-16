"""Async client for the Piston code execution sandbox API."""

from dataclasses import dataclass

import httpx

from app.config import settings

LANGUAGE_MAP: dict[str, str] = {
    "c": "c",
    "cpp": "c++",
    "python": "python",
    "pypy": "pypy",
    "rust": "rust",
    "go": "go",
    "java": "java",
    "kotlin": "kotlin",
    "javascript": "javascript",
}

SUPPORTED_LANGUAGES: frozenset[str] = frozenset(LANGUAGE_MAP)

_FILE_NAMES: dict[str, str] = {
    "c": "main.c",
    "cpp": "main.cpp",
    "python": "main.py",
    "pypy": "main.py",
    "rust": "main.rs",
    "go": "main.go",
    "java": "Main.java",
    "kotlin": "main.kt",
    "javascript": "main.js",
}


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

    Raises RuntimeError on HTTP or network errors.
    """
    piston_lang = LANGUAGE_MAP.get(language, language)
    filename = _FILE_NAMES.get(language, "main.txt")

    payload = {
        "language": piston_lang,
        "version": "*",
        "files": [{"name": filename, "content": code}],
        "stdin": stdin,
        "run_timeout": time_limit_ms,
        "compile_timeout": 10_000,
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

    timed_out = run.get("signal") == "SIGKILL" and time_ms >= time_limit_ms * 0.9

    return ExecutionResult(
        stdout=run.get("stdout") or "",
        stderr=run.get("stderr") or "",
        exit_code=(run.get("code") or 0),
        compile_error=compile_error,
        time_ms=time_ms,
        memory_kb=memory_kb,
        timed_out=timed_out,
    )
