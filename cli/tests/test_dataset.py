"""Tests for reinfo.dataset (get_dataset / submit_predictions)."""

import os
import time
from unittest.mock import patch

import httpx
import pandas as pd
import pytest

from reinfo import config, dataset


def _csv_response(text, status_code=200):
    return httpx.Response(
        status_code=status_code,
        content=text.encode("utf-8"),
        request=httpx.Request("GET", "https://api.reinfo.ro/"),
    )


def _save_creds():
    config.save_credentials(
        config.Credentials(token="reinfo_x", username="alice", api_url="https://api.reinfo.ro")
    )


def test_get_dataset_cache_miss_fetches_and_caches():
    train_csv = "id,value\n1,10\n2,20\n"
    test_csv = "id,value\n3,30\n"
    sample_csv = "id,target\n3,0\n"

    with patch(
        "httpx.get",
        side_effect=[_csv_response(train_csv), _csv_response(test_csv), _csv_response(sample_csv)],
    ):
        data = dataset.get_dataset("titanic-survival")

    assert list(data.train["value"]) == [10, 20]
    assert list(data.test["value"]) == [30]
    assert list(data.sample_submission["target"]) == [0]
    assert dataset._cache_file("titanic-survival", "train.csv").exists()


def test_get_dataset_not_found():
    with (
        patch("httpx.get", return_value=_csv_response("", status_code=404)),
        pytest.raises(dataset.DatasetError),
    ):
        dataset.get_dataset("nonexistent")


def test_fetch_csv_fresh_cache_skips_network(monkeypatch):
    monkeypatch.setattr(dataset, "_CACHE_TTL_SECONDS", 3600)
    client = dataset.ReinfoClient("https://api.reinfo.ro", token=None)

    cache_file = dataset._cache_file("titanic-survival", "train.csv")
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_file.write_text("id,value\n1,999\n")

    with patch("httpx.get", side_effect=AssertionError("should not hit network")):
        df = dataset._fetch_csv(client, "titanic-survival", "train.csv", use_cache=True)

    assert list(df["value"]) == [999]


def test_fetch_csv_stale_cache_refetches(monkeypatch):
    monkeypatch.setattr(dataset, "_CACHE_TTL_SECONDS", 1)
    client = dataset.ReinfoClient("https://api.reinfo.ro", token=None)

    cache_file = dataset._cache_file("titanic-survival", "train.csv")
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_file.write_text("id,value\n1,999\n")
    stale_time = time.time() - 10
    os.utime(cache_file, (stale_time, stale_time))

    with patch("httpx.get", return_value=_csv_response("id,value\n1,10\n")):
        df = dataset._fetch_csv(client, "titanic-survival", "train.csv", use_cache=True)

    assert list(df["value"]) == [10]


def test_submit_predictions_requires_login():
    df = pd.DataFrame({"id": [1], "target": [0]})
    with pytest.raises(dataset.DatasetError):
        dataset.submit_predictions("titanic-survival", df)


def test_submit_predictions_missing_columns(json_response):
    _save_creds()
    problem_resp = json_response(
        {
            "dataset_id_column": "id",
            "dataset_target_column": "target",
            "dataset_expected_rows": None,
        }
    )
    df = pd.DataFrame({"id": [1]})

    with patch("httpx.get", return_value=problem_resp), pytest.raises(dataset.ValidationError):
        dataset.submit_predictions("titanic-survival", df)


def test_submit_predictions_wrong_row_count(json_response):
    _save_creds()
    problem_resp = json_response(
        {"dataset_id_column": "id", "dataset_target_column": "target", "dataset_expected_rows": 5}
    )
    df = pd.DataFrame({"id": [1, 2], "target": [0, 1]})

    with patch("httpx.get", return_value=problem_resp), pytest.raises(dataset.ValidationError):
        dataset.submit_predictions("titanic-survival", df)


def test_submit_predictions_polls_until_judged(json_response):
    _save_creds()
    problem_resp = json_response(
        {
            "dataset_id_column": "id",
            "dataset_target_column": "target",
            "dataset_expected_rows": None,
        }
    )
    submit_resp = json_response({"id": "sub-1"})
    pending_resp = json_response({"id": "sub-1", "judged_at": None})
    done_resp = json_response(
        {"id": "sub-1", "judged_at": "2026-01-01T00:00:00Z", "verdict": "AC", "score": 100}
    )
    df = pd.DataFrame({"id": [1], "target": [0]})

    with (
        patch("httpx.get", side_effect=[problem_resp, pending_resp, done_resp]),
        patch("httpx.post", return_value=submit_resp),
        patch("time.sleep"),
    ):
        result = dataset.submit_predictions("titanic-survival", df, timeout=5.0)

    assert result["verdict"] == "AC"


def test_submit_predictions_timeout(json_response, monkeypatch):
    monkeypatch.setattr(dataset, "_POLL_INTERVAL_SECONDS", 0.01)
    _save_creds()
    problem_resp = json_response(
        {
            "dataset_id_column": "id",
            "dataset_target_column": "target",
            "dataset_expected_rows": None,
        }
    )
    submit_resp = json_response({"id": "sub-1"})
    df = pd.DataFrame({"id": [1], "target": [0]})

    calls = {"n": 0}

    def _get_side_effect(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            return problem_resp
        return json_response({"id": "sub-1", "judged_at": None})

    with (
        patch("httpx.get", side_effect=_get_side_effect),
        patch("httpx.post", return_value=submit_resp),
        pytest.raises(dataset.DatasetError),
    ):
        dataset.submit_predictions("titanic-survival", df, timeout=0.05)
