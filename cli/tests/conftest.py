import httpx
import pytest
from click.testing import CliRunner

from reinfo import config, dataset


@pytest.fixture(autouse=True)
def _isolated_credentials(tmp_path, monkeypatch):
    """Never touch the real ~/.reinfo/credentials.json or dataset cache while testing."""
    monkeypatch.setattr(config, "_CREDENTIALS_PATH", tmp_path / "credentials.json")
    monkeypatch.setattr(dataset, "_CACHE_DIR", tmp_path / "cache")
    monkeypatch.delenv("REINFO_TOKEN", raising=False)
    monkeypatch.delenv("REINFO_API_URL", raising=False)


@pytest.fixture
def runner():
    return CliRunner()


@pytest.fixture
def json_response():
    def _make(payload, status_code=200):
        return httpx.Response(
            status_code=status_code,
            json=payload,
            request=httpx.Request("GET", "https://api.reinfo.ro/"),
        )

    return _make
