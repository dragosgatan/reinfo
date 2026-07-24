"""realtime fan-out over websockets, with cross-process broadcast via postgres listen/notify"""

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
DUEL_CHANNEL = "reinfo_duel"
NOTIFICATION_CHANNEL = "reinfo_notifications"
CLASS_CHAT_CHANNEL = "reinfo_class_chat"


class LeaderboardHub:
    """tracks active websocket subscribers, grouped by contest slug"""

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


class DuelHub:
    """tracks active websocket subscribers for duel rooms, keyed by duel_id string"""

    def __init__(self) -> None:
        self._sockets: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, duel_id: str, ws: WebSocket) -> None:
        async with self._lock:
            self._sockets[duel_id].add(ws)

    async def disconnect(self, duel_id: str, ws: WebSocket) -> None:
        async with self._lock:
            subs = self._sockets.get(duel_id)
            if subs is None:
                return
            subs.discard(ws)
            if not subs:
                self._sockets.pop(duel_id, None)

    async def broadcast(self, duel_id: str, payload: dict[str, Any]) -> None:
        async with self._lock:
            targets = list(self._sockets.get(duel_id, ()))
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                subs = self._sockets.get(duel_id)
                if subs is not None:
                    for ws in dead:
                        subs.discard(ws)


duel_hub = DuelHub()


class NotificationHub:
    """tracks active websocket subscribers for per-user notification delivery"""

    def __init__(self) -> None:
        self._sockets: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        async with self._lock:
            self._sockets[user_id].add(ws)

    async def disconnect(self, user_id: str, ws: WebSocket) -> None:
        async with self._lock:
            subs = self._sockets.get(user_id)
            if subs is None:
                return
            subs.discard(ws)
            if not subs:
                self._sockets.pop(user_id, None)

    async def send(self, user_id: str, payload: dict[str, Any]) -> None:
        async with self._lock:
            targets = list(self._sockets.get(user_id, ()))
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                subs = self._sockets.get(user_id)
                if subs is not None:
                    for ws in dead:
                        subs.discard(ws)


notification_hub = NotificationHub()


class ClassChatHub:
    """tracks websocket subscribers for class group chat, keyed by class_id string"""

    def __init__(self) -> None:
        self._sockets: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, class_id: str, ws: WebSocket) -> None:
        async with self._lock:
            self._sockets[class_id].add(ws)

    async def disconnect(self, class_id: str, ws: WebSocket) -> None:
        async with self._lock:
            subs = self._sockets.get(class_id)
            if subs is None:
                return
            subs.discard(ws)
            if not subs:
                self._sockets.pop(class_id, None)

    async def broadcast(self, class_id: str, payload: dict[str, Any]) -> None:
        async with self._lock:
            targets = list(self._sockets.get(class_id, ()))
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                subs = self._sockets.get(class_id)
                if subs is not None:
                    for ws in dead:
                        subs.discard(ws)


class_chat_hub = ClassChatHub()


def _to_asyncpg_dsn(sqlalchemy_url: str) -> str:
    """turn `postgresql+asyncpg://...` into the plain dsn asyncpg expects"""
    parsed = urlparse(sqlalchemy_url)
    scheme = parsed.scheme.split("+", 1)[0] or "postgresql"
    return urlunparse(parsed._replace(scheme=scheme))


async def publish_contest_update(session: AsyncSession, contest_slug: str) -> None:
    """emit a notify for the given contest slug on the leaderboard channel"""
    await session.execute(
        text("SELECT pg_notify(:channel, :payload)").bindparams(
            channel=LEADERBOARD_CHANNEL, payload=contest_slug
        )
    )


async def publish_duel_update(session: AsyncSession, duel_id: str) -> None:
    """emit a notify for the given duel_id on the duel channel"""
    await session.execute(
        text("SELECT pg_notify(:channel, :payload)").bindparams(
            channel=DUEL_CHANNEL, payload=duel_id
        )
    )


async def publish_notification(session: AsyncSession, user_id: str, payload: str) -> None:
    """emit a notify for a user notification; payload is `<user_id>:<json>`"""
    await session.execute(
        text("SELECT pg_notify(:channel, :payload)").bindparams(
            channel=NOTIFICATION_CHANNEL, payload=f"{user_id}:{payload}"
        )
    )


async def publish_class_message(session: AsyncSession, class_id: str, payload: str) -> None:
    """emit a notify for a class chat message; payload is `<class_id>:<json>`"""
    await session.execute(
        text("SELECT pg_notify(:channel, :payload)").bindparams(
            channel=CLASS_CHAT_CHANNEL, payload=f"{class_id}:{payload}"
        )
    )


OnUpdate = Callable[[str], Awaitable[None]]


async def run_listener(
    on_leaderboard_update: OnUpdate,
    stop_event: asyncio.Event,
    on_duel_update: OnUpdate | None = None,
    on_notification: OnUpdate | None = None,
    on_class_chat: OnUpdate | None = None,
) -> None:
    """subscribe to postgres notify events and dispatch them locally; reconnects on failure, returns when `stop_event` is set"""
    dsn = _to_asyncpg_dsn(settings.database_url)
    while not stop_event.is_set():
        conn: asyncpg.Connection | None = None
        try:
            conn = await asyncpg.connect(dsn=dsn)

            def _leaderboard_handler(_conn: object, _pid: int, _channel: str, payload: str) -> None:
                with suppress(RuntimeError):
                    asyncio.create_task(on_leaderboard_update(payload))

            await conn.add_listener(LEADERBOARD_CHANNEL, _leaderboard_handler)

            if on_duel_update is not None:

                def _duel_handler(_conn: object, _pid: int, _channel: str, payload: str) -> None:
                    with suppress(RuntimeError):
                        asyncio.create_task(on_duel_update(payload))

                await conn.add_listener(DUEL_CHANNEL, _duel_handler)

            if on_notification is not None:

                def _notification_handler(
                    _conn: object, _pid: int, _channel: str, payload: str
                ) -> None:
                    with suppress(RuntimeError):
                        asyncio.create_task(on_notification(payload))

                await conn.add_listener(NOTIFICATION_CHANNEL, _notification_handler)

            if on_class_chat is not None:

                def _class_chat_handler(
                    _conn: object, _pid: int, _channel: str, payload: str
                ) -> None:
                    with suppress(RuntimeError):
                        asyncio.create_task(on_class_chat(payload))

                await conn.add_listener(CLASS_CHAT_CHANNEL, _class_chat_handler)

            log.info(
                "listeners attached to channels %s, %s, %s, %s",
                LEADERBOARD_CHANNEL,
                DUEL_CHANNEL,
                NOTIFICATION_CHANNEL,
                CLASS_CHAT_CHANNEL,
            )
            wait_task = asyncio.create_task(stop_event.wait())
            await wait_task
        except Exception:
            log.exception("realtime listener crashed; reconnecting in 2s")
            await asyncio.sleep(2)
        finally:
            if conn is not None:
                with suppress(Exception):
                    await conn.close()
