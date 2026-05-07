"""File storage helpers for test case .in/.out files.

All paths are resolved and validated against the configured data directory
before any I/O to prevent path traversal attacks.
"""

import uuid
from pathlib import Path

import aiofiles

from app.config import settings

_MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB per file


def _data_root() -> Path:
    return Path(settings.data_dir).resolve()


def _test_case_path(problem_id: uuid.UUID, ordinal: int, ext: str) -> Path:
    if ordinal < 0:
        raise ValueError("Ordinal must be non-negative")
    return _data_root() / "problems" / str(problem_id) / "tests" / f"{ordinal}{ext}"


def _assert_inside_data_root(path: Path) -> None:
    if not path.resolve().is_relative_to(_data_root()):
        raise PermissionError("Path is outside the configured data directory")


async def save_test_case(
    problem_id: uuid.UUID,
    ordinal: int,
    input_bytes: bytes,
    output_bytes: bytes,
) -> tuple[str, str]:
    """Write .in and .out files for a test case.

    Returns (input_path, output_path) as absolute path strings.
    Raises ValueError for invalid ordinal, PermissionError on traversal attempt.
    """
    in_path = _test_case_path(problem_id, ordinal, ".in")
    out_path = _test_case_path(problem_id, ordinal, ".out")

    _assert_inside_data_root(in_path)
    _assert_inside_data_root(out_path)

    in_path.parent.mkdir(parents=True, exist_ok=True)

    async with aiofiles.open(in_path, "wb") as fh:
        await fh.write(input_bytes)
    async with aiofiles.open(out_path, "wb") as fh:
        await fh.write(output_bytes)

    return str(in_path), str(out_path)


async def read_test_case(path: str) -> bytes:
    """Read a test case file by its stored absolute path string.

    Raises FileNotFoundError if the file is missing,
    PermissionError if the path escapes the data directory.
    """
    resolved = Path(path).resolve()
    _assert_inside_data_root(resolved)

    async with aiofiles.open(resolved, "rb") as fh:
        return await fh.read()


async def delete_test_case(input_path: str, output_path: str) -> None:
    """Delete .in and .out files; silently skips files that do not exist."""
    for raw in (input_path, output_path):
        resolved = Path(raw).resolve()
        _assert_inside_data_root(resolved)
        if resolved.exists():
            resolved.unlink()


def _submission_path(user_id: uuid.UUID, submission_id: uuid.UUID, filename: str) -> Path:
    return _data_root() / "submissions" / str(user_id) / str(submission_id) / filename


async def save_submission_output(
    user_id: uuid.UUID,
    submission_id: uuid.UUID,
    file_bytes: bytes,
) -> str:
    """Write the uploaded output file for a submission.

    Returns the absolute path string.
    """
    path = _submission_path(user_id, submission_id, "output.out")
    _assert_inside_data_root(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(path, "wb") as fh:
        await fh.write(file_bytes)
    return str(path)


async def save_submission_code(
    user_id: uuid.UUID,
    submission_id: uuid.UUID,
    language: str,
    file_bytes: bytes,
) -> str:
    """Write the optional source code file for a submission.

    Returns the absolute path string.
    """
    safe_lang = "".join(c for c in language if c.isalnum() or c in "_+#")[:16] or "txt"
    path = _submission_path(user_id, submission_id, f"source.{safe_lang}")
    _assert_inside_data_root(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(path, "wb") as fh:
        await fh.write(file_bytes)
    return str(path)
