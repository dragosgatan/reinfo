"""Tests for /api/auth/* endpoints."""
import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Session as DbSession
from app.models.user import User

_USER: dict = {
    "username": "testuser",
    "email": "test@example.com",
    "password": "secret123",
    "display_name": "Test User",
}


async def _register(client: AsyncClient, overrides: dict | None = None) -> dict:
    data = {**_USER, **(overrides or {})}
    r = await client.post("/api/auth/register", json=data)
    return r


async def _login(client: AsyncClient, username: str = "testuser", password: str = "secret123") -> dict:
    return await client.post("/api/auth/login", json={"username": username, "password": password})


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient) -> None:
    r = await _register(client)
    assert r.status_code == 201
    body = r.json()
    assert body["username"] == "testuser"
    assert body["email"] == "test@example.com"
    assert "password_hash" not in body
    assert "id" in body


@pytest.mark.asyncio
async def test_register_duplicate_username(client: AsyncClient) -> None:
    await _register(client)
    r = await _register(client, {"email": "other@example.com"})
    assert r.status_code == 409
    assert "username" in r.json()["detail"]


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient) -> None:
    await _register(client)
    r = await _register(client, {"username": "otheruser"})
    assert r.status_code == 409
    assert "email" in r.json()["detail"]


@pytest.mark.asyncio
async def test_register_username_too_short(client: AsyncClient) -> None:
    r = await _register(client, {"username": "ab"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_register_username_too_long(client: AsyncClient) -> None:
    r = await _register(client, {"username": "a" * 21})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_register_username_invalid_chars(client: AsyncClient) -> None:
    r = await _register(client, {"username": "test-user"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_register_invalid_email(client: AsyncClient) -> None:
    r = await _register(client, {"email": "notanemail"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_register_short_password(client: AsyncClient) -> None:
    r = await _register(client, {"password": "short"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient) -> None:
    await _register(client)
    r = await _login(client)
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == "testuser"
    assert "reinfo_session" in r.cookies


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient) -> None:
    await _register(client)
    r = await _login(client, password="wrongpassword")
    assert r.status_code == 401
    assert "reinfo_session" not in r.cookies


@pytest.mark.asyncio
async def test_login_unknown_user(client: AsyncClient) -> None:
    r = await _login(client, username="nobody")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_creates_session_row(client: AsyncClient, db_session: AsyncSession) -> None:
    await _register(client)
    r = await _login(client)
    token = r.cookies["reinfo_session"]
    row = await db_session.scalar(select(DbSession).where(DbSession.token == token))
    assert row is not None
    assert row.expires_at > datetime.now(UTC)


@pytest.mark.asyncio
async def test_logout_success(client: AsyncClient, db_session: AsyncSession) -> None:
    await _register(client)
    login_r = await _login(client)
    token = login_r.cookies["reinfo_session"]

    r = await client.post("/api/auth/logout")
    assert r.status_code == 200
    assert r.json()["message"] is not None
    # cookie must be cleared (max-age=0 or deleted)
    assert r.cookies.get("reinfo_session") is None or r.cookies["reinfo_session"] == ""

    row = await db_session.scalar(select(DbSession).where(DbSession.token == token))
    assert row is None


@pytest.mark.asyncio
async def test_logout_without_session_is_idempotent(client: AsyncClient) -> None:
    r = await client.post("/api/auth/logout")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_me_authenticated(client: AsyncClient) -> None:
    await _register(client)
    await _login(client)

    r = await client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["username"] == "testuser"


@pytest.mark.asyncio
async def test_me_no_cookie(client: AsyncClient) -> None:
    r = await client.get("/api/auth/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_invalid_token(client: AsyncClient) -> None:
    client.cookies.set("reinfo_session", "not-a-real-token")
    r = await client.get("/api/auth/me")
    assert r.status_code == 401
    client.cookies.delete("reinfo_session")


@pytest.mark.asyncio
async def test_me_expired_session(client: AsyncClient, db_session: AsyncSession) -> None:
    reg = await _register(client)
    user_id = uuid.UUID(reg.json()["id"])

    expired = DbSession(
        user_id=user_id,
        token="expired-session-token-xyz",
        expires_at=datetime(2020, 1, 1, tzinfo=UTC),
    )
    db_session.add(expired)
    await db_session.commit()

    client.cookies.set("reinfo_session", "expired-session-token-xyz")
    r = await client.get("/api/auth/me")
    assert r.status_code == 401
    client.cookies.delete("reinfo_session")


@pytest.mark.asyncio
async def test_me_updates_last_active_at(client: AsyncClient, db_session: AsyncSession) -> None:
    await _register(client)
    await _login(client)

    before = datetime.now(UTC)
    r = await client.get("/api/auth/me")
    assert r.status_code == 200

    user = await db_session.scalar(select(User).where(User.username == "testuser"))
    assert user is not None
    # refresh to see the updated value committed by get_current_user
    await db_session.refresh(user)
    assert user.last_active_at >= before
