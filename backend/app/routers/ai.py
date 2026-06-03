"""AI-gated endpoints - auth + per-user rate limiting for AI features."""

import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.dependencies import get_current_user
from app.models.user import User, UserRole

router = APIRouter(prefix="/api/ai", tags=["ai"])

_RATE_LIMITED_ROLES = {UserRole.student, UserRole.teacher}
_MINUTE_LIMIT = 10
_DAY_LIMIT = 100

# Sliding-window buckets keyed by user ID.
# Safe in asyncio (single-threaded event loop, no concurrent mutation).
_minute_log: dict[str, deque[float]] = defaultdict(deque)
_day_log: dict[str, deque[float]] = defaultdict(deque)


def _check_rate_limit(user_id: str) -> None:
    """Raise 429 if the user has exceeded 10/min or 100/day."""
    now = time.monotonic()
    minute_ago = now - 60
    day_ago = now - 86400

    minute_q = _minute_log[user_id]
    while minute_q and minute_q[0] <= minute_ago:
        minute_q.popleft()
    if len(minute_q) >= _MINUTE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests - try again in a minute",
            headers={"Retry-After": "60"},
        )

    day_q = _day_log[user_id]
    while day_q and day_q[0] <= day_ago:
        day_q.popleft()
    if len(day_q) >= _DAY_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Daily limit reached - try again tomorrow",
            headers={"Retry-After": "86400"},
        )

    minute_q.append(now)
    day_q.append(now)


@router.post("/lesson-chat/check", status_code=status.HTTP_204_NO_CONTENT)
async def check_lesson_chat_access(
    current_user: User = Depends(get_current_user),
    _session: AsyncSession = Depends(get_session),
) -> None:
    """Verify session and apply rate limits before the Next.js route calls OpenRouter."""
    if current_user.role in _RATE_LIMITED_ROLES:
        _check_rate_limit(str(current_user.id))
