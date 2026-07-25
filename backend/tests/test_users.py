"""Tests for PATCH /api/users/me: theme persistence."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.security import hash_password

_PASSWORD = "testpassword1"


async def _make_user(db: AsyncSession, username: str) -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        password_hash=hash_password(_PASSWORD),
        display_name=username,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _login(client: AsyncClient, username: str) -> None:
    r = await client.post("/api/auth/login", json={"username": username, "password": _PASSWORD})
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_theme_defaults_to_null(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "theme-user1")
    await _login(client, "theme-user1")

    r = await client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["theme"] is None


@pytest.mark.asyncio
async def test_set_theme(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "theme-user2")
    await _login(client, "theme-user2")

    r = await client.patch("/api/users/me", json={"theme": "ocean"})
    assert r.status_code == 200
    assert r.json()["theme"] == "ocean"

    r2 = await client.get("/api/auth/me")
    assert r2.json()["theme"] == "ocean"


@pytest.mark.asyncio
async def test_clear_theme(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "theme-user3")
    await _login(client, "theme-user3")

    await client.patch("/api/users/me", json={"theme": "high-contrast"})
    r = await client.patch("/api/users/me", json={"theme": None})
    assert r.status_code == 200
    assert r.json()["theme"] is None


@pytest.mark.asyncio
async def test_invalid_theme_rejected(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "theme-user4")
    await _login(client, "theme-user4")

    r = await client.patch("/api/users/me", json={"theme": "not-a-real-theme"})
    assert r.status_code == 422
