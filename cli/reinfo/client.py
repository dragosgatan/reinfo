"""Thin httpx wrapper for talking to the reinfo backend."""

from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any

import httpx


class ApiError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"[{status_code}] {detail}")


class NetworkError(Exception):
    def __init__(self, url: str, error: str) -> None:
        self.url = url
        self.error = error
        super().__init__(f"{url}: {error}")


class ReinfoClient:
    def __init__(self, base_url: str, token: str | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token

    def _headers(self) -> dict[str, str]:
        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _raise_for_status(self, resp: httpx.Response) -> None:
        if resp.status_code >= 400:
            try:
                detail = resp.json().get("detail", resp.text)
            except ValueError:
                detail = resp.text
            raise ApiError(resp.status_code, str(detail))

    def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        url = f"{self.base_url}{path}"
        try:
            resp = httpx.get(url, params=params, headers=self._headers(), timeout=30.0)
        except httpx.HTTPError as exc:
            raise NetworkError(url, str(exc)) from exc
        self._raise_for_status(resp)
        return resp.json()

    def get_bytes(self, path: str) -> bytes:
        url = f"{self.base_url}{path}"
        try:
            resp = httpx.get(url, headers=self._headers(), timeout=30.0)
        except httpx.HTTPError as exc:
            raise NetworkError(url, str(exc)) from exc
        self._raise_for_status(resp)
        return resp.content

    def post_json(self, path: str, json_body: dict[str, Any] | None = None) -> Any:
        url = f"{self.base_url}{path}"
        try:
            resp = httpx.post(url, json=json_body, headers=self._headers(), timeout=30.0)
        except httpx.HTTPError as exc:
            raise NetworkError(url, str(exc)) from exc
        self._raise_for_status(resp)
        return resp.json()

    def post_form(
        self, path: str, data: dict[str, Any], files: dict[str, Any] | None = None
    ) -> Any:
        url = f"{self.base_url}{path}"
        try:
            resp = httpx.post(url, data=data, files=files, headers=self._headers(), timeout=60.0)
        except httpx.HTTPError as exc:
            raise NetworkError(url, str(exc)) from exc
        self._raise_for_status(resp)
        return resp.json()

    def stream_sse(self, path: str) -> Iterator[dict[str, Any]]:
        """Yield each `data: {...}` JSON payload from an SSE endpoint."""
        url = f"{self.base_url}{path}"
        try:
            with httpx.stream("GET", url, headers=self._headers(), timeout=120.0) as resp:
                if resp.status_code >= 400:
                    resp.read()
                    self._raise_for_status(resp)
                for line in resp.iter_lines():
                    if not line.startswith("data: "):
                        continue
                    raw = line[len("data: ") :].strip()
                    if raw == "[DONE]":
                        continue
                    try:
                        yield json.loads(raw)
                    except ValueError:
                        continue
        except httpx.HTTPError as exc:
            raise NetworkError(url, str(exc)) from exc
