"""lesson ai chat: streams a tutoring response from openrouter, grounded in the lesson content, cached and rate-limited per user"""

import json
from collections.abc import AsyncGenerator
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_chat import check_rate_limit, get_cached_response, record_usage, store_cached_response
from app.config import settings
from app.db import get_session
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/ai", tags=["ai"])

_MODEL = "deepseek/deepseek-v4-flash"
_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class LessonChatRequest(BaseModel):
    lesson_slug: str
    lesson_title: str
    lesson_content: str
    messages: list[ChatMessage]


def _system_prompt(lesson_title: str, lesson_content: str) -> str:
    return (
        "You are a helpful programming tutor assistant for ReInfo, a Romanian "
        "competitive programming platform. You are helping a student understand "
        f"the following lesson.\n\nTitle: {lesson_title}\n\nLesson content (Markdown):\n"
        f"{lesson_content}\n\nAnswer questions about this lesson clearly and concisely. "
        "Explain concepts in a student-friendly way. If the student asks something "
        "unrelated to the lesson, gently redirect them back to the topic."
    )


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


async def _cached_stream(text: str) -> AsyncGenerator[str, None]:
    yield _sse({"choices": [{"delta": {"content": text}}]})
    yield "data: [DONE]\n\n"


async def _model_stream(
    session: AsyncSession,
    user: User,
    data: LessonChatRequest,
    last_message: str,
) -> AsyncGenerator[str, None]:
    payload = {
        "model": _MODEL,
        "messages": [
            {"role": "system", "content": _system_prompt(data.lesson_title, data.lesson_content)},
            *[m.model_dump() for m in data.messages],
        ],
        "stream": True,
        "stream_options": {"include_usage": True},
    }
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://reinfo.ro",
        "X-Title": "ReInfo",
    }

    accumulated = ""
    prompt_tokens = 0
    completion_tokens = 0

    try:
        async with (
            httpx.AsyncClient(timeout=60.0) as client,
            client.stream("POST", _OPENROUTER_URL, headers=headers, json=payload) as resp,
        ):
            if resp.status_code != 200:
                yield _sse({"error": "model_error"})
                return

            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                yield f"{line}\n\n"

                raw = line[len("data: ") :].strip()
                if raw == "[DONE]":
                    continue
                try:
                    chunk = json.loads(raw)
                except ValueError:
                    continue

                choices = chunk.get("choices") or []
                delta = choices[0].get("delta", {}).get("content") if choices else None
                if delta:
                    accumulated += delta

                usage = chunk.get("usage")
                if usage:
                    prompt_tokens = usage.get("prompt_tokens", 0)
                    completion_tokens = usage.get("completion_tokens", 0)
    except httpx.HTTPError:
        yield _sse({"error": "network_error"})
        return

    if accumulated:
        await store_cached_response(session, data.lesson_slug, last_message, accumulated)
    await record_usage(
        session, user.id, data.lesson_slug, prompt_tokens, completion_tokens, cache_hit=False
    )


@router.post("/lesson-chat")
async def lesson_chat(
    data: LessonChatRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """stream a tutoring response for the last user message, grounded in the lesson"""
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Trebuie să confirmi adresa de email pentru a folosi asistentul AI",
        )

    last_message = next((m.content for m in reversed(data.messages) if m.role == "user"), None)
    if not data.messages or not last_message or not data.lesson_title or not data.lesson_content:
        raise HTTPException(status_code=400, detail="Missing fields")

    cached = await get_cached_response(session, data.lesson_slug, last_message)
    if cached is not None:
        await record_usage(session, current_user.id, data.lesson_slug, 0, 0, cache_hit=True)
        return StreamingResponse(_cached_stream(cached), media_type="text/event-stream")

    await check_rate_limit(session, current_user)

    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Asistentul AI nu este configurat momentan",
        )

    return StreamingResponse(
        _model_stream(session, current_user, data, last_message),
        media_type="text/event-stream",
    )
