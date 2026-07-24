"""device-authorization-flow login for the reinfo cli (rfc 8628, simplified)"""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.dependencies import get_current_user
from app.models.api_token import ApiToken, DeviceAuthRequest, DeviceAuthStatus
from app.models.user import User
from app.schemas.device_auth import (
    DeviceCodeAction,
    DeviceInfoResponse,
    DevicePollRequest,
    DevicePollResponse,
    DeviceStartResponse,
)
from app.security import generate_api_token, generate_token, generate_user_code, hash_token

router = APIRouter(prefix="/api/auth/device", tags=["device-auth"])

_DEVICE_CODE_TTL = timedelta(minutes=10)
_POLL_INTERVAL_SECONDS = 5


@router.post("/start", response_model=DeviceStartResponse)
async def start_device_auth(session: AsyncSession = Depends(get_session)) -> DeviceStartResponse:
    device_code = generate_token(32)
    user_code = generate_user_code()
    while await session.scalar(
        select(DeviceAuthRequest).where(DeviceAuthRequest.user_code == user_code)
    ):
        user_code = generate_user_code()

    expires_at = datetime.now(UTC) + _DEVICE_CODE_TTL
    session.add(
        DeviceAuthRequest(device_code=device_code, user_code=user_code, expires_at=expires_at)
    )
    await session.commit()

    base = settings.frontend_url.rstrip("/")
    verification_uri = f"{base}/cli-auth"
    return DeviceStartResponse(
        device_code=device_code,
        user_code=user_code,
        verification_uri=verification_uri,
        verification_uri_complete=f"{verification_uri}?code={user_code}",
        expires_in=int(_DEVICE_CODE_TTL.total_seconds()),
        interval=_POLL_INTERVAL_SECONDS,
    )


@router.post("/poll", response_model=DevicePollResponse)
async def poll_device_auth(
    data: DevicePollRequest, session: AsyncSession = Depends(get_session)
) -> DevicePollResponse:
    req = await session.scalar(
        select(DeviceAuthRequest).where(DeviceAuthRequest.device_code == data.device_code)
    )
    if req is None:
        raise HTTPException(status_code=404, detail="Cod invalid")

    now = datetime.now(UTC)
    if req.status == DeviceAuthStatus.pending and req.expires_at <= now:
        req.status = DeviceAuthStatus.expired

    if req.status == DeviceAuthStatus.pending:
        await session.commit()
        return DevicePollResponse(status="pending")

    if req.status in (DeviceAuthStatus.denied, DeviceAuthStatus.expired):
        result = DevicePollResponse(status=req.status.value)
        await session.delete(req)
        await session.commit()
        return result

    token = req.issued_token_plaintext
    username = None
    if req.user_id:
        user = await session.get(User, req.user_id)
        username = user.username if user else None
    await session.delete(req)
    await session.commit()
    return DevicePollResponse(status="approved", token=token, username=username)


@router.get("/info", response_model=DeviceInfoResponse)
async def device_auth_info(
    code: str = Query(...), session: AsyncSession = Depends(get_session)
) -> DeviceInfoResponse:
    req = await session.scalar(
        select(DeviceAuthRequest).where(DeviceAuthRequest.user_code == code.upper())
    )
    if req is None or req.status != DeviceAuthStatus.pending or req.expires_at <= datetime.now(UTC):
        return DeviceInfoResponse(valid=False)
    return DeviceInfoResponse(valid=True, expires_at=req.expires_at)


@router.post("/approve", status_code=status.HTTP_204_NO_CONTENT)
async def approve_device_auth(
    data: DeviceCodeAction,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    req = await session.scalar(
        select(DeviceAuthRequest).where(DeviceAuthRequest.user_code == data.user_code.upper())
    )
    if req is None or req.status != DeviceAuthStatus.pending or req.expires_at <= datetime.now(UTC):
        raise HTTPException(status_code=400, detail="Cod invalid sau expirat")

    raw_token = generate_api_token()
    session.add(
        ApiToken(
            user_id=current_user.id,
            label=f"CLI login {datetime.now(UTC):%Y-%m-%d %H:%M}",
            token_hash=hash_token(raw_token),
        )
    )
    req.status = DeviceAuthStatus.approved
    req.user_id = current_user.id
    req.issued_token_plaintext = raw_token
    await session.commit()


@router.post("/deny", status_code=status.HTTP_204_NO_CONTENT)
async def deny_device_auth(
    data: DeviceCodeAction,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    req = await session.scalar(
        select(DeviceAuthRequest).where(DeviceAuthRequest.user_code == data.user_code.upper())
    )
    if req is None or req.status != DeviceAuthStatus.pending:
        raise HTTPException(status_code=400, detail="Cod invalid sau expirat")

    req.status = DeviceAuthStatus.denied
    await session.commit()
