"""credential storage and configuration for the reinfo cli"""

from __future__ import annotations

import json
import os
import stat
from dataclasses import dataclass
from pathlib import Path

DEFAULT_API_URL = "https://api.reinfo.ro"

_CONFIG_DIR = Path.home() / ".reinfo"
_CREDENTIALS_PATH = _CONFIG_DIR / "credentials.json"


@dataclass
class Credentials:
    token: str
    username: str
    api_url: str


def credentials_path() -> Path:
    return _CREDENTIALS_PATH


def save_credentials(creds: Credentials) -> None:
    _CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    _CREDENTIALS_PATH.write_text(
        json.dumps({"token": creds.token, "username": creds.username, "api_url": creds.api_url}),
        encoding="utf-8",
    )
    if os.name == "posix":
        os.chmod(_CREDENTIALS_PATH, stat.S_IRUSR | stat.S_IWUSR)


def load_credentials() -> Credentials | None:
    if not _CREDENTIALS_PATH.exists():
        return None
    try:
        data = json.loads(_CREDENTIALS_PATH.read_text(encoding="utf-8"))
        return Credentials(token=data["token"], username=data["username"], api_url=data["api_url"])
    except (json.JSONDecodeError, KeyError, OSError):
        return None


def clear_credentials() -> None:
    if _CREDENTIALS_PATH.exists():
        _CREDENTIALS_PATH.unlink()


def resolve_api_url(cli_option: str | None) -> str:
    """--api-url > REINFO_API_URL env > saved credentials > default"""
    if cli_option:
        return cli_option.rstrip("/")
    env = os.environ.get("REINFO_API_URL")
    if env:
        return env.rstrip("/")
    creds = load_credentials()
    if creds:
        return creds.api_url.rstrip("/")
    return DEFAULT_API_URL


def resolve_token() -> str | None:
    """REINFO_TOKEN env (handy for ci) takes priority over the saved credential"""
    env = os.environ.get("REINFO_TOKEN")
    if env:
        return env
    creds = load_credentials()
    return creds.token if creds else None
