"""Tests for the CLI device-auth flow, API token management, and bearer-token auth."""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_token import ApiToken, DeviceAuthRequest
from app.models.user import User

_USER = {
    "username": "clidevuser",
    "email": "clidev@example.com",
    "password": "secret123",
    "display_name": "CLI Dev User",
}


async def _register_and_login(client: AsyncClient) -> None:
    r = await client.post("/api/auth/register", json=_USER)
    assert r.status_code == 201, r.text
    r = await client.post(
        "/api/auth/login", json={"username": _USER["username"], "password": _USER["password"]}
    )
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_device_flow_happy_path(client: AsyncClient, db_session: AsyncSession) -> None:
    start = await client.post("/api/auth/device/start")
    assert start.status_code == 200
    body = start.json()
    assert body["verification_uri_complete"].endswith(f"?code={body['user_code']}")
    assert body["interval"] > 0
    assert body["expires_in"] > 0

    device_code = body["device_code"]
    user_code = body["user_code"]

    info = await client.get("/api/auth/device/info", params={"code": user_code})
    assert info.status_code == 200
    assert info.json()["valid"] is True

    poll_pending = await client.post("/api/auth/device/poll", json={"device_code": device_code})
    assert poll_pending.status_code == 200
    assert poll_pending.json()["status"] == "pending"

    await _register_and_login(client)

    approve = await client.post("/api/auth/device/approve", json={"user_code": user_code})
    assert approve.status_code == 204

    poll_approved = await client.post("/api/auth/device/poll", json={"device_code": device_code})
    assert poll_approved.status_code == 200
    approved_body = poll_approved.json()
    assert approved_body["status"] == "approved"
    assert approved_body["username"] == _USER["username"]
    assert approved_body["token"].startswith("reinfo_")

    # The device request is consumed after one successful poll - replaying 404s.
    poll_again = await client.post("/api/auth/device/poll", json={"device_code": device_code})
    assert poll_again.status_code == 404

    # The issued token authenticates like a normal session, via Authorization header.
    token = approved_body["token"]
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == _USER["username"]

    api_tokens = (await db_session.scalars(select(ApiToken))).all()
    assert len(api_tokens) == 1
    assert api_tokens[0].last_used_at is not None


@pytest.mark.asyncio
async def test_device_flow_deny(client: AsyncClient, db_session: AsyncSession) -> None:
    start = await client.post("/api/auth/device/start")
    user_code = start.json()["user_code"]
    device_code = start.json()["device_code"]

    await _register_and_login(client)
    deny = await client.post("/api/auth/device/deny", json={"user_code": user_code})
    assert deny.status_code == 204

    poll = await client.post("/api/auth/device/poll", json={"device_code": device_code})
    assert poll.status_code == 200
    assert poll.json()["status"] == "denied"


@pytest.mark.asyncio
async def test_device_flow_expired(client: AsyncClient, db_session: AsyncSession) -> None:
    req = DeviceAuthRequest(
        device_code="expired-device-code",
        user_code="EXPI-RED1",
        expires_at=datetime.now(UTC) - timedelta(minutes=1),
    )
    db_session.add(req)
    await db_session.commit()

    poll = await client.post("/api/auth/device/poll", json={"device_code": "expired-device-code"})
    assert poll.status_code == 200
    assert poll.json()["status"] == "expired"

    info = await client.get("/api/auth/device/info", params={"code": "EXPI-RED1"})
    assert info.json()["valid"] is False


@pytest.mark.asyncio
async def test_approve_requires_login(client: AsyncClient, db_session: AsyncSession) -> None:
    start = await client.post("/api/auth/device/start")
    user_code = start.json()["user_code"]

    approve = await client.post("/api/auth/device/approve", json={"user_code": user_code})
    assert approve.status_code == 401


@pytest.mark.asyncio
async def test_approve_unknown_code_returns_400(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register_and_login(client)
    approve = await client.post("/api/auth/device/approve", json={"user_code": "NOPE-NOPE"})
    assert approve.status_code == 400


@pytest.mark.asyncio
async def test_token_list_and_revoke(client: AsyncClient, db_session: AsyncSession) -> None:
    await _register_and_login(client)

    start = await client.post("/api/auth/device/start")
    user_code = start.json()["user_code"]
    device_code = start.json()["device_code"]
    await client.post("/api/auth/device/approve", json={"user_code": user_code})
    poll = await client.post("/api/auth/device/poll", json={"device_code": device_code})
    token = poll.json()["token"]

    tokens = await client.get("/api/auth/tokens")
    assert tokens.status_code == 200
    items = tokens.json()
    assert len(items) == 1
    assert items[0]["revoked_at"] is None
    token_id = items[0]["id"]

    # Token works before revocation.
    r_ok = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r_ok.status_code == 200

    revoke = await client.delete(f"/api/auth/tokens/{token_id}")
    assert revoke.status_code == 204

    # Revoking again is idempotent.
    revoke_again = await client.delete(f"/api/auth/tokens/{token_id}")
    assert revoke_again.status_code == 204

    # Revoked token no longer authenticates.
    r_revoked = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r_revoked.status_code == 401


@pytest.mark.asyncio
async def test_cannot_revoke_another_users_token(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = User(
        username="tokenowner",
        email="owner@example.com",
        password_hash="x",
        display_name="Owner",
    )
    db_session.add(owner)
    await db_session.commit()
    await db_session.refresh(owner)

    from app.security import generate_api_token, hash_token

    raw = generate_api_token()
    other_token = ApiToken(user_id=owner.id, label="not yours", token_hash=hash_token(raw))
    db_session.add(other_token)
    await db_session.commit()
    await db_session.refresh(other_token)

    await _register_and_login(client)
    r = await client.delete(f"/api/auth/tokens/{other_token.id}")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_bearer_token_works_on_unrelated_endpoint(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Confirms the dependency-level change covers every existing route, not just
    a bespoke CLI-only endpoint - list_problems already depends on get_optional_user."""
    await _register_and_login(client)
    start = await client.post("/api/auth/device/start")
    user_code = start.json()["user_code"]
    device_code = start.json()["device_code"]
    await client.post("/api/auth/device/approve", json={"user_code": user_code})
    poll = await client.post("/api/auth/device/poll", json={"device_code": device_code})
    token = poll.json()["token"]

    r = await client.get("/api/problems", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
