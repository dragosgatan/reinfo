"""tests for the lesson ai chat: db-backed rate limiting, response caching, usage logging; the openrouter call is mocked"""

import json
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.ai_chat import AiChatCache, AiChatUsage
from app.models.user import User, UserRole
from app.security import hash_password

_PASSWORD = "testpassword1"


async def _make_user(db: AsyncSession, username: str, role: UserRole = UserRole.student) -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        password_hash=hash_password(_PASSWORD),
        display_name=username,
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _login(client: AsyncClient, username: str) -> None:
    r = await client.post("/api/auth/login", json={"username": username, "password": _PASSWORD})
    assert r.status_code == 200, r.text


def _chat_body(message: str, lesson_slug: str = "vectori") -> dict:
    return {
        "lesson_slug": lesson_slug,
        "lesson_title": "Vectori",
        "lesson_content": "Un vector este o structură de date...",
        "messages": [{"role": "user", "content": message}],
    }


class _FakeAsyncCM:
    """minimal async context manager wrapping a pre-built fake response"""

    def __init__(self, response: "_FakeResponse") -> None:
        self._response = response

    async def __aenter__(self) -> "_FakeResponse":
        return self._response

    async def __aexit__(self, *exc: object) -> bool:
        return False


class _FakeResponse:
    def __init__(self, status_code: int, lines: list[str]) -> None:
        self.status_code = status_code
        self._lines = lines

    async def aiter_lines(self):
        for line in self._lines:
            yield line


def _mock_openrouter_stream(lines: list[str], status_code: int = 200):
    """patch httpx.asyncclient.stream to return a fake sse response with `lines`"""

    def fake_stream(self, method, url, **kwargs):
        return _FakeAsyncCM(_FakeResponse(status_code, lines))

    return patch("httpx.AsyncClient.stream", new=fake_stream)


def _sse_lines(*contents: str, prompt_tokens: int = 12, completion_tokens: int = 34) -> list[str]:
    lines = [f"data: {json.dumps({'choices': [{'delta': {'content': c}}]})}" for c in contents]
    lines.append(
        f"data: {json.dumps({'choices': [], 'usage': {'prompt_tokens': prompt_tokens, 'completion_tokens': completion_tokens}})}"
    )
    lines.append("data: [DONE]")
    return lines


@pytest.fixture(autouse=True)
def _configure_openrouter_key():
    with patch.object(settings, "openrouter_api_key", "test-key"):
        yield


@pytest.mark.asyncio
async def test_first_request_calls_model_streams_and_logs_usage(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "chat-user1")
    await _login(client, "chat-user1")

    with _mock_openrouter_stream(_sse_lines("Bună, ", "un vector este...")):
        r = await client.post("/api/ai/lesson-chat", json=_chat_body("ce e un vector?"))

    assert r.status_code == 200
    assert "un vector este..." in r.text

    usage = (await db_session.scalars(select(AiChatUsage))).all()
    assert len(usage) == 1
    assert usage[0].cache_hit is False
    assert usage[0].prompt_tokens == 12
    assert usage[0].completion_tokens == 34

    cached = await db_session.scalar(select(AiChatCache))
    assert cached is not None
    assert "un vector este..." in cached.response_text


@pytest.mark.asyncio
async def test_identical_request_hits_cache_and_skips_model_call(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "chat-user2")
    await _login(client, "chat-user2")

    with _mock_openrouter_stream(_sse_lines("first answer")):
        r1 = await client.post("/api/ai/lesson-chat", json=_chat_body("ce e un stack?"))
        assert r1.status_code == 200

    # second, identical (lesson, question) pair, stream must never be called
    with patch("httpx.AsyncClient.stream") as mocked_second:
        r2 = await client.post("/api/ai/lesson-chat", json=_chat_body("ce e un stack?"))
        assert r2.status_code == 200
        mocked_second.assert_not_called()

    assert "first answer" in r2.text

    usage = (await db_session.scalars(select(AiChatUsage).order_by(AiChatUsage.created_at))).all()
    assert len(usage) == 2
    assert usage[0].cache_hit is False
    assert usage[1].cache_hit is True
    assert usage[1].prompt_tokens == 0
    assert usage[1].completion_tokens == 0


@pytest.mark.asyncio
async def test_cache_key_ignores_case_and_surrounding_whitespace(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "chat-user3")
    await _login(client, "chat-user3")

    with _mock_openrouter_stream(_sse_lines("answer")):
        await client.post("/api/ai/lesson-chat", json=_chat_body("Ce e un STACK?"))

    with patch("httpx.AsyncClient.stream") as mocked:
        r2 = await client.post("/api/ai/lesson-chat", json=_chat_body("  ce e un stack?  "))
        mocked.assert_not_called()
    assert "answer" in r2.text


@pytest.mark.asyncio
async def test_burst_limit_enforced(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "chat-burst")
    await _login(client, "chat-burst")

    with patch.object(settings, "chatbot_burst_limit", 2):
        for i in range(2):
            with _mock_openrouter_stream(_sse_lines(f"answer {i}")):
                r = await client.post("/api/ai/lesson-chat", json=_chat_body(f"question {i}"))
                assert r.status_code == 200

        r3 = await client.post("/api/ai/lesson-chat", json=_chat_body("question 3"))
        assert r3.status_code == 429
        assert "Retry-After" in r3.headers
        assert "prea multe întrebări" in r3.json()["detail"]


@pytest.mark.asyncio
async def test_daily_limit_enforced_with_romanian_reset_message(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "chat-daily")
    await _login(client, "chat-daily")

    with (
        patch.object(settings, "chatbot_daily_limit", 1),
        patch.object(settings, "chatbot_burst_limit", 100),
    ):
        with _mock_openrouter_stream(_sse_lines("answer")):
            r1 = await client.post("/api/ai/lesson-chat", json=_chat_body("q1"))
            assert r1.status_code == 200

        r2 = await client.post("/api/ai/lesson-chat", json=_chat_body("q2"))
        assert r2.status_code == 429
        body = r2.json()
        assert "limita zilnică" in body["detail"]
        assert "Retry-After" in r2.headers


@pytest.mark.asyncio
async def test_admin_is_exempt_from_rate_limits(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "chat-admin", role=UserRole.admin)
    await _login(client, "chat-admin")

    with (
        patch.object(settings, "chatbot_daily_limit", 1),
        patch.object(settings, "chatbot_burst_limit", 1),
    ):
        for i in range(3):
            with _mock_openrouter_stream(_sse_lines(f"answer {i}")):
                r = await client.post("/api/ai/lesson-chat", json=_chat_body(f"question {i}"))
                assert r.status_code == 200


@pytest.mark.asyncio
async def test_cache_hit_does_not_count_against_exhausted_limit(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "chat-cachefree")
    await _login(client, "chat-cachefree")

    with (
        patch.object(settings, "chatbot_daily_limit", 1),
        patch.object(settings, "chatbot_burst_limit", 100),
    ):
        with _mock_openrouter_stream(_sse_lines("answer")):
            r1 = await client.post("/api/ai/lesson-chat", json=_chat_body("same question"))
            assert r1.status_code == 200

        # daily limit is exhausted, but the exact same question is a cache hit and must succeed
        with patch("httpx.AsyncClient.stream") as mocked:
            r2 = await client.post("/api/ai/lesson-chat", json=_chat_body("same question"))
            assert r2.status_code == 200
            mocked.assert_not_called()

        # a genuinely new question is correctly blocked
        r3 = await client.post("/api/ai/lesson-chat", json=_chat_body("a brand new question"))
        assert r3.status_code == 429


@pytest.mark.asyncio
async def test_missing_openrouter_key_returns_503(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "chat-nokey")
    await _login(client, "chat-nokey")

    with patch.object(settings, "openrouter_api_key", ""):
        r = await client.post("/api/ai/lesson-chat", json=_chat_body("orice"))
        assert r.status_code == 503


@pytest.mark.asyncio
async def test_requires_login(client: AsyncClient, db_session: AsyncSession) -> None:
    r = await client.post("/api/ai/lesson-chat", json=_chat_body("orice"))
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_missing_user_message_returns_400(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "chat-empty")
    await _login(client, "chat-empty")

    body = _chat_body("irrelevant")
    body["messages"] = []
    r = await client.post("/api/ai/lesson-chat", json=body)
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_model_error_status_does_not_log_usage(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "chat-modelerror")
    await _login(client, "chat-modelerror")

    with _mock_openrouter_stream([], status_code=500):
        r = await client.post("/api/ai/lesson-chat", json=_chat_body("question"))
        assert r.status_code == 200
        assert "model_error" in r.text

    count = await db_session.scalar(select(func.count()).select_from(AiChatUsage))
    assert count == 0
