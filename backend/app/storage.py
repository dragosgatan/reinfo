"""file storage helpers; all paths are resolved and validated against the data directory before i/o, to prevent path traversal"""

import time
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
    """write .in and .out files for a test case, returns (input_path, output_path) as absolute strings"""
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
    """read a test case file by its stored absolute path string"""
    resolved = Path(path).resolve()
    _assert_inside_data_root(resolved)

    async with aiofiles.open(resolved, "rb") as fh:
        return await fh.read()


async def delete_test_case(input_path: str, output_path: str) -> None:
    """delete .in and .out files, silently skips files that do not exist"""
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
    """write the uploaded output file for a submission, returns the absolute path string"""
    path = _submission_path(user_id, submission_id, "output.out")
    _assert_inside_data_root(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(path, "wb") as fh:
        await fh.write(file_bytes)
    return str(path)


_ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_AVATAR_BYTES = 2 * 1024 * 1024  # 2 MB
_AVATAR_EXT_MAP = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def _avatar_path(user_id: uuid.UUID, ext: str) -> Path:
    return _data_root() / "avatars" / f"{user_id}{ext}"


async def save_avatar(user_id: uuid.UUID, content_type: str, data: bytes) -> str:
    """save an uploaded avatar image and return the url path, e.g. /avatars/{user_id}.jpg"""
    if content_type not in _ALLOWED_AVATAR_TYPES:
        raise ValueError(f"Unsupported image type: {content_type}")
    if len(data) > _MAX_AVATAR_BYTES:
        raise ValueError("Avatar exceeds 2 MB size limit")

    ext = _AVATAR_EXT_MAP[content_type]
    path = _avatar_path(user_id, ext)
    _assert_inside_data_root(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    # remove any previously stored avatar with a different extension
    for old_ext in _AVATAR_EXT_MAP.values():
        old = _avatar_path(user_id, old_ext)
        if old != path and old.exists():
            old.unlink()

    async with aiofiles.open(path, "wb") as fh:
        await fh.write(data)

    # Include a version timestamp so browsers always load the new image after re-upload
    return f"/avatars/{user_id}{ext}?v={int(time.time())}"


def avatars_directory() -> Path:
    """return the avatars directory, creating it if needed"""
    d = _data_root() / "avatars"
    d.mkdir(parents=True, exist_ok=True)
    return d


_DATASET_DOWNLOADABLE_FILES = {"train.csv", "test.csv", "sample_submission.csv"}
_DATASET_FILES = _DATASET_DOWNLOADABLE_FILES | {"answer.csv"}


def _dataset_path(slug: str, filename: str) -> Path:
    if filename not in _DATASET_FILES:
        raise ValueError(f"Invalid dataset filename: {filename}")
    return _data_root() / "datasets" / slug / filename


async def save_dataset_file(slug: str, filename: str, data: bytes) -> str:
    """write one of a dataset problem's fixed csv files (train/test/sample_submission/answer)"""
    path = _dataset_path(slug, filename)
    _assert_inside_data_root(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(path, "wb") as fh:
        await fh.write(data)
    return str(path)


async def read_dataset_file(slug: str, filename: str) -> bytes:
    """read one of a dataset problem's csv files by slug + filename"""
    path = _dataset_path(slug, filename)
    _assert_inside_data_root(path)
    async with aiofiles.open(path, "rb") as fh:
        return await fh.read()


def dataset_file_exists(slug: str, filename: str) -> bool:
    return _dataset_path(slug, filename).exists()


async def save_submission_csv(
    user_id: uuid.UUID,
    submission_id: uuid.UUID,
    file_bytes: bytes,
) -> str:
    """write the submitted predictions csv for a dataset-problem submission"""
    path = _submission_path(user_id, submission_id, "predictions.csv")
    _assert_inside_data_root(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(path, "wb") as fh:
        await fh.write(file_bytes)
    return str(path)


def _ctf_attachment_path(challenge_id: uuid.UUID, filename: str) -> Path:
    safe_name = Path(filename).name
    return _data_root() / "ctf" / str(challenge_id) / safe_name


async def save_ctf_attachment(challenge_id: uuid.UUID, filename: str, data: bytes) -> str:
    path = _ctf_attachment_path(challenge_id, filename)
    _assert_inside_data_root(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(path, "wb") as fh:
        await fh.write(data)
    return str(path)


async def read_ctf_attachment(path: str) -> bytes:
    resolved = Path(path).resolve()
    _assert_inside_data_root(resolved)
    async with aiofiles.open(resolved, "rb") as fh:
        return await fh.read()


async def delete_ctf_attachment(path: str) -> None:
    resolved = Path(path).resolve()
    _assert_inside_data_root(resolved)
    if resolved.exists():
        resolved.unlink()


async def save_submission_code(
    user_id: uuid.UUID,
    submission_id: uuid.UUID,
    language: str,
    file_bytes: bytes,
) -> str:
    """write the optional source code file for a submission, returns the absolute path string"""
    safe_lang = "".join(c for c in language if c.isalnum() or c in "_+#")[:16] or "txt"
    path = _submission_path(user_id, submission_id, f"source.{safe_lang}")
    _assert_inside_data_root(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(path, "wb") as fh:
        await fh.write(file_bytes)
    return str(path)
