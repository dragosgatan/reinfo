"""Caching, rate limiting, and usage logging for the lesson AI chat (S6).

The actual OpenRouter call lives in app.routers.ai (it needs to stream chunks
straight through to the response) - this module holds everything around that
call: whether to skip it (cache), whether to allow it (rate limit), and what
to record afterward (usage log).
"""

import hashlib
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.ai_chat import AiChatCache, AiChatUsage
from app.models.user import User, UserRole

_CACHE_TTL = timedelta(hours=24)


def cache_key(lesson_slug: str, message: str) -> str:
    normalized = message.strip().lower()
    digest = hashlib.sha256(f"{lesson_slug}\n{normalized}".encode()).hexdigest()
    return digest


async def get_cached_response(session: AsyncSession, lesson_slug: str, message: str) -> str | None:
    key = cache_key(lesson_slug, message)
    cutoff = datetime.now(UTC) - _CACHE_TTL
    entry = await session.scalar(
        select(AiChatCache).where(AiChatCache.cache_key == key, AiChatCache.created_at >= cutoff)
    )
    return entry.response_text if entry else None


async def store_cached_response(
    session: AsyncSession, lesson_slug: str, message: str, response_text: str
) -> None:
    key = cache_key(lesson_slug, message)
    existing = await session.scalar(select(AiChatCache).where(AiChatCache.cache_key == key))
    if existing is not None:
        existing.response_text = response_text
        existing.created_at = datetime.now(UTC)
    else:
        session.add(
            AiChatCache(cache_key=key, lesson_slug=lesson_slug, response_text=response_text)
        )
    await session.commit()


async def _count_usage_since(session: AsyncSession, user_id, since: datetime) -> int:
    return (
        await session.scalar(
            select(func.count())
            .select_from(AiChatUsage)
            .where(
                AiChatUsage.user_id == user_id,
                AiChatUsage.cache_hit.is_(False),
                AiChatUsage.created_at >= since,
            )
        )
        or 0
    )


async def _oldest_usage_since(
    session: AsyncSession, user_id, since: datetime
) -> AiChatUsage | None:
    return await session.scalar(
        select(AiChatUsage)
        .where(
            AiChatUsage.user_id == user_id,
            AiChatUsage.cache_hit.is_(False),
            AiChatUsage.created_at >= since,
        )
        .order_by(AiChatUsage.created_at.asc())
        .limit(1)
    )


async def check_rate_limit(session: AsyncSession, user: User) -> None:
    """Raise 429 if the user is over the burst or daily cap. Cache hits never
    count toward either - only real model calls consume the quota. Admins and
    superusers are exempt entirely."""
    if user.role in (UserRole.admin, UserRole.superuser):
        return

    now = datetime.now(UTC)

    burst_since = now - timedelta(seconds=settings.chatbot_burst_window_seconds)
    burst_count = await _count_usage_since(session, user.id, burst_since)
    if burst_count >= settings.chatbot_burst_limit:
        retry_after = settings.chatbot_burst_window_seconds
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Ai trimis prea multe întrebări într-un timp scurt. "
                f"Mai încearcă în {retry_after} secunde."
            ),
            headers={"Retry-After": str(retry_after)},
        )

    day_since = now - timedelta(hours=24)
    day_count = await _count_usage_since(session, user.id, day_since)
    if day_count >= settings.chatbot_daily_limit:
        oldest = await _oldest_usage_since(session, user.id, day_since)
        reset_at = oldest.created_at + timedelta(hours=24) if oldest else now + timedelta(hours=24)
        retry_after = max(1, int((reset_at - now).total_seconds()))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Ai atins limita zilnică de {settings.chatbot_daily_limit} întrebări către "
                f"asistentul AI. Poți întreba din nou la ora {reset_at.strftime('%H:%M')}."
            ),
            headers={"Retry-After": str(retry_after)},
        )


async def record_usage(
    session: AsyncSession,
    user_id,
    lesson_slug: str,
    prompt_tokens: int,
    completion_tokens: int,
    *,
    cache_hit: bool,
) -> None:
    session.add(
        AiChatUsage(
            user_id=user_id,
            lesson_slug=lesson_slug,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cache_hit=cache_hit,
        )
    )
    await session.commit()
