import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

import httpx
import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.config import settings
from app.db import engine
from app.limiter import limiter
from app.realtime import class_chat_hub, notification_hub, run_listener
from app.routers import (
    admin,
    ai,
    auth,
    classrooms,
    contests,
    ctf,
    device_auth,
    duels,
    languages,
    lessons,
    problems,
    projects,
    roadmaps,
    social,
    submissions,
    tracks,
)
from app.routers import users as users_router
from app.routers.contests import dispatch_leaderboard_update
from app.routers.duels import dispatch_duel_update
from app.storage import avatars_directory

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.05,
    )

log = logging.getLogger(__name__)


async def _dispatch_notification(payload: str) -> None:
    """route a raw notify payload to the right user's websocket(s)"""
    try:
        import json

        user_id, json_part = payload.split(":", 1)
        data = json.loads(json_part)
        await notification_hub.send(user_id, data)
    except Exception:
        log.exception("failed to dispatch notification payload: %r", payload)


async def _dispatch_class_chat(payload: str) -> None:
    """route a raw class-chat notify payload to the right class room"""
    try:
        import json

        class_id, json_part = payload.split(":", 1)
        data = json.loads(json_part)
        await class_chat_hub.broadcast(class_id, data)
    except Exception:
        log.exception("failed to dispatch class chat payload: %r", payload)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    stop_event = asyncio.Event()
    listener_task = asyncio.create_task(
        run_listener(
            dispatch_leaderboard_update,
            stop_event,
            on_duel_update=dispatch_duel_update,
            on_notification=_dispatch_notification,
            on_class_chat=_dispatch_class_chat,
        )
    )
    try:
        yield
    finally:
        stop_event.set()
        listener_task.cancel()
        with suppress(asyncio.CancelledError, Exception):
            await listener_task


app = FastAPI(
    title="ReInfo API",
    description="Backend API pentru platforma ReInfo de programare competitivă",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
    redirect_slashes=False,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(device_auth.router)
app.include_router(users_router.router)
app.include_router(admin.router)
app.include_router(ai.router)
app.include_router(problems.router)
app.include_router(languages.router)
app.include_router(submissions.router)
app.include_router(contests.router)
app.include_router(duels.router)
app.include_router(lessons.router)
app.include_router(roadmaps.router)
app.include_router(social.router)
app.include_router(classrooms.router)
app.include_router(ctf.router)
app.include_router(tracks.router)
app.include_router(projects.router)

app.mount("/avatars", StaticFiles(directory=str(avatars_directory())), name="avatars")


@app.get("/api/health", tags=["system"])
async def health() -> dict[str, str]:
    """check server health"""
    return {"status": "ok"}


@app.get("/api/health/detailed", tags=["system"])
async def health_detailed() -> dict[str, object]:
    """check database and piston connectivity"""
    checks: dict[str, str] = {}

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        log.exception("health check: database unreachable")
        checks["database"] = "error"

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.piston_url}/api/v2/runtimes")
            checks["piston"] = "ok" if resp.status_code == 200 else "error"
    except Exception:
        checks["piston"] = "error"

    overall = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": overall, "checks": checks}
