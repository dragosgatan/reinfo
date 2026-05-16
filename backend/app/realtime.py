"""Realtime fan-out for the contest leaderboard.

A single FastAPI worker keeps WebSocket connections in an in-process hub.
Cross-process broadcasts (worker → web) ride on Postgres LISTEN/NOTIFY so
no extra infra is required. The web process subscribes to one channel and
re-publishes each notification to all sockets registered for that contest.
"""

import asyncio
import logging
from collections import defaultdict
from collections.abc import Awaitable, Callable
from contextlib import suppress
from typing import Any
from urllib.parse import urlparse, urlunparse

import asyncpg
from fastapi import WebSocket
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

log = logging.getLogger(__name__)

LEADERBOARD_CHANNEL = "reinfo_leaderboard"


class LeaderboardHub:
    """Tracks active WebSocket subscribers, grouped by contest slug."""

    def __init__(self) -> None:
        self._sockets: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, slug: str, ws: WebSocket) -> None:
        async with self._lock:
            self._sockets[slug].add(ws)

    async def disconnect(self, slug: str, ws: WebSocket) -> None:
        async with self._lock:
            subs = self._sockets.get(slug)
            if subs is None:
                return
            subs.discard(ws)
            if not subs:
                self._sockets.pop(slug, None)

    async def broadcast(self, slug: str, payload: dict[str, Any]) -> None:
        async with self._lock:
            targets = list(self._sockets.get(slug, ()))
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                subs = self._sockets.get(slug)
                if subs is not None:
                    for ws in dead:
                        subs.discard(ws)


hub = LeaderboardHub()


def _to_asyncpg_dsn(sqlalchemy_url: str) -> str:
    """Turn `postgresql+asyncpg://...` into the plain DSN asyncpg expects."""
    parsed = urlparse(sqlalchemy_url)
    scheme = parsed.scheme.split("+", 1)[0] or "postgresql"
    return urlunparse(parsed._replace(scheme=scheme))


async def publish_contest_update(session: AsyncSession, contest_slug: str) -> None:
    """Emit a NOTIFY for the given contest slug on the shared channel.

    Runs on the same connection as the surrounding transaction so the notify
    is only delivered when that transaction commits.
    """
    await session.execute(
        text("SELECT pg_notify(:channel, :payload)").bindparams(
            channel=LEADERBOARD_CHANNEL, payload=contest_slug
        )
    )


OnUpdate = Callable[[str], Awaitable[None]]


async def run_listener(on_update: OnUpdate, stop_event: asyncio.Event) -> None:
    """Subscribe to Postgres NOTIFY events and dispatch them locally.

    Re-connects on failure. Returns when `stop_event` is set.
    """
    dsn = _to_asyncpg_dsn(settings.database_url)
    while not stop_event.is_set():
        conn: asyncpg.Connection | None = None
        try:
            conn = await asyncpg.connect(dsn=dsn)

            def _handler(_conn: object, _pid: int, _channel: str, payload: str) -> None:
                with suppress(RuntimeError):
                    asyncio.create_task(on_update(payload))

            await conn.add_listener(LEADERBOARD_CHANNEL, _handler)
            log.info("leaderboard listener attached to channel %s", LEADERBOARD_CHANNEL)
            wait_task = asyncio.create_task(stop_event.wait())
            await wait_task
        except Exception:
            log.exception("leaderboard listener crashed; reconnecting in 2s")
            await asyncio.sleep(2)
        finally:
            if conn is not None:
                with suppress(Exception):
                    await conn.close()
