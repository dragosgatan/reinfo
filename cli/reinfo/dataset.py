"""dataset helper for ai/dataset problems: get_dataset() and submit_predictions()"""

from __future__ import annotations

import io
import time
from dataclasses import dataclass
from pathlib import Path

try:
    import pandas as pd
except ImportError as exc:
    raise ImportError("reinfo.dataset requires pandas: pip install reinfo[dataset]") from exc

from reinfo.client import ApiError, NetworkError, ReinfoClient
from reinfo.config import resolve_api_url, resolve_token
from reinfo.i18n import t

_CACHE_DIR = Path.home() / ".reinfo" / "cache"
_CACHE_TTL_SECONDS = 6 * 3600
_POLL_INTERVAL_SECONDS = 1.0


class DatasetError(Exception):
    pass


class ValidationError(DatasetError):
    pass


@dataclass
class Dataset:
    slug: str
    train: pd.DataFrame | None
    test: pd.DataFrame | None
    sample_submission: pd.DataFrame | None


def _client() -> ReinfoClient:
    return ReinfoClient(resolve_api_url(None), resolve_token())


def _cache_file(slug: str, filename: str) -> Path:
    return _CACHE_DIR / slug / filename


def _fetch_csv(
    client: ReinfoClient, slug: str, filename: str, use_cache: bool
) -> pd.DataFrame | None:
    cache_file = _cache_file(slug, filename)
    if (
        use_cache
        and cache_file.exists()
        and time.time() - cache_file.stat().st_mtime < _CACHE_TTL_SECONDS
    ):
        return pd.read_csv(cache_file)

    try:
        content = client.get_bytes(f"/api/problems/{slug}/dataset/{filename}")
    except ApiError as exc:
        if exc.status_code == 404:
            return None
        raise

    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_file.write_bytes(content)
    return pd.read_csv(io.BytesIO(content))


def get_dataset(slug: str, use_cache: bool = True, locale: str = "ro") -> Dataset:
    """download a dataset problem's public csv files as pandas dataframes, cached under ~/.reinfo/cache/<slug>/ for 6 hours"""
    client = _client()
    try:
        train = _fetch_csv(client, slug, "train.csv", use_cache)
        test = _fetch_csv(client, slug, "test.csv", use_cache)
        sample = _fetch_csv(client, slug, "sample_submission.csv", use_cache)
    except NetworkError as exc:
        raise DatasetError(t("network_error", locale, url=exc.url, error=exc.error)) from exc
    except ApiError as exc:
        raise DatasetError(
            t("api_error", locale, status=exc.status_code, detail=exc.detail)
        ) from exc

    if train is None and test is None and sample is None:
        raise DatasetError(t("dataset_not_found", locale, slug=slug))

    return Dataset(slug=slug, train=train, test=test, sample_submission=sample)


def submit_predictions(
    slug: str, df: pd.DataFrame, locale: str = "ro", timeout: float = 300.0
) -> dict:
    """validate df's columns/row count, submit it as csv, and poll until judged"""
    client = _client()
    if not client.token:
        raise DatasetError(t("not_logged_in", locale))

    try:
        problem = client.get(f"/api/problems/{slug}")
    except ApiError as exc:
        raise DatasetError(
            t("api_error", locale, status=exc.status_code, detail=exc.detail)
        ) from exc
    except NetworkError as exc:
        raise DatasetError(t("network_error", locale, url=exc.url, error=exc.error)) from exc

    id_col = problem.get("dataset_id_column") or "id"
    target_col = problem.get("dataset_target_column") or "target"
    expected_rows = problem.get("dataset_expected_rows")

    missing = [c for c in (id_col, target_col) if c not in df.columns]
    if missing:
        raise ValidationError(t("dataset_missing_columns", locale, columns=", ".join(missing)))
    if expected_rows is not None and len(df) != expected_rows:
        raise ValidationError(
            t("dataset_wrong_row_count", locale, expected=expected_rows, actual=len(df))
        )

    csv_bytes = df[[id_col, target_col]].to_csv(index=False).encode("utf-8")

    try:
        submission = client.post_form(
            f"/api/problems/{slug}/submit-dataset",
            data={},
            files={"csv_file": ("predictions.csv", csv_bytes, "text/csv")},
        )
    except ApiError as exc:
        raise DatasetError(
            t("api_error", locale, status=exc.status_code, detail=exc.detail)
        ) from exc
    except NetworkError as exc:
        raise DatasetError(t("network_error", locale, url=exc.url, error=exc.error)) from exc

    submission_id = submission["id"]
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        data = client.get(f"/api/submissions/{submission_id}")
        if data.get("judged_at"):
            return data
        time.sleep(_POLL_INTERVAL_SECONDS)

    raise DatasetError(t("dataset_submit_timeout", locale, timeout=int(timeout)))
