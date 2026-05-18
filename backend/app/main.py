import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.limiter import limiter
from app.realtime import run_listener
from app.routers import auth, contests, duels, lessons, problems, submissions
from app.routers.contests import dispatch_leaderboard_update
from app.routers.duels import dispatch_duel_update

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    stop_event = asyncio.Event()
    listener_task = asyncio.create_task(
        run_listener(dispatch_leaderboard_update, stop_event, on_duel_update=dispatch_duel_update)
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
app.include_router(problems.router)
app.include_router(submissions.router)
app.include_router(contests.router)
app.include_router(duels.router)
app.include_router(lessons.router)


@app.get("/api/health", tags=["system"])
async def health() -> dict[str, str]:
    """Verifică starea serverului."""
    return {"status": "ok"}
