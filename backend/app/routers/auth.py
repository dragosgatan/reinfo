import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.dependencies import SESSION_COOKIE_NAME, SESSION_EXPIRY_DAYS, get_current_user
from app.email import send_password_reset_email
from app.limiter import limiter
from app.models.api_token import ApiToken
from app.models.user import PasswordResetToken, User
from app.models.user import Session as DbSession
from app.schemas.device_auth import ApiTokenRead
from app.schemas.user import (
    ForgotPasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
    UserCreate,
    UserProfileRead,
    UserRead,
)
from app.security import generate_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

_COOKIE_MAX_AGE = SESSION_EXPIRY_DAYS * 24 * 3600
_RESET_TOKEN_EXPIRY_HOURS = 1


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    request: Request,
    data: UserCreate,
    session: AsyncSession = Depends(get_session),
) -> UserRead:
    """Înregistrează un cont nou. Nu creează sesiune - utilizatorul trebuie să facă login separat."""
    existing = await session.scalar(
        select(User).where((User.username == data.username) | (User.email == data.email))
    )
    if existing is not None:
        field = "username" if existing.username == data.username else "email"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Există deja un cont cu acest {field}",
        )

    user = User(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
        display_name=data.display_name,
        language=data.language,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return UserRead.model_validate(user)


@router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    response: Response,
    data: LoginRequest,
    session: AsyncSession = Depends(get_session),
) -> UserRead:
    """Autentifică utilizatorul și setează cookie-ul HTTP-only de sesiune."""
    user = await session.scalar(select(User).where(User.username == data.username))
    if user is None or not verify_password(data.password, user.password_hash):
        # same message for both cases to avoid user enumeration
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nume de utilizator sau parolă incorecte",
        )

    token = generate_token()
    db_session = DbSession(
        user_id=user.id,
        token=token,
        expires_at=datetime.now(UTC) + timedelta(days=SESSION_EXPIRY_DAYS),
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    session.add(db_session)
    user.last_active_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(user)

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=_COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        domain=settings.cookie_domain or None,
    )
    return UserRead.model_validate(user)


@router.post("/logout")
async def logout(
    response: Response,
    reinfo_session: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """Șterge sesiunea curentă. Idempotent - nu eșuează dacă nu există sesiune."""
    if reinfo_session:
        db_session = await session.scalar(
            select(DbSession).where(DbSession.token == reinfo_session)
        )
        if db_session is not None:
            await session.delete(db_session)
            await session.commit()

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        samesite="lax",
        domain=settings.cookie_domain or None,
    )
    return {"message": "Deconectat cu succes"}


@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """Trimite un email cu link de resetare a parolei, dacă adresa există.

    Răspunsul este identic indiferent dacă emailul există sau nu, pentru a
    evita enumerarea conturilor.
    """
    user = await session.scalar(select(User).where(User.email == data.email))
    if user is not None:
        token = generate_token()
        reset_token = PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.now(UTC) + timedelta(hours=_RESET_TOKEN_EXPIRY_HOURS),
        )
        session.add(reset_token)
        await session.commit()

        await send_password_reset_email(user.email, token, user.language)

    return {"message": "Dacă adresa există, am trimis un email cu instrucțiuni"}


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    data: ResetPasswordRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """Resetează parola pe baza unui token valid, neexpirat și nefolosit."""
    reset_token = await session.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token == data.token,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > datetime.now(UTC),
        )
    )
    if reset_token is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Link de resetare invalid sau expirat",
        )

    user = await session.get(User, reset_token.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Link de resetare invalid sau expirat",
        )

    user.password_hash = hash_password(data.password)
    reset_token.used_at = datetime.now(UTC)
    await session.execute(delete(DbSession).where(DbSession.user_id == user.id))
    await session.commit()
    return {"message": "Parola a fost resetată cu succes"}


@router.get("/me")
async def me(user: User = Depends(get_current_user)) -> UserRead:
    """Returnează datele utilizatorului autentificat curent."""
    return UserRead.model_validate(user)


@router.get("/tokens", response_model=list[ApiTokenRead])
async def list_api_tokens(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ApiTokenRead]:
    """CLI personal access tokens belonging to the current user, newest first."""
    rows = await session.scalars(
        select(ApiToken)
        .where(ApiToken.user_id == current_user.id)
        .order_by(ApiToken.created_at.desc())
    )
    return [ApiTokenRead.model_validate(t) for t in rows]


@router.delete("/tokens/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_token(
    token_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Revoke one of the current user's own tokens. Idempotent."""
    token = await session.scalar(
        select(ApiToken).where(ApiToken.id == token_id, ApiToken.user_id == current_user.id)
    )
    if token is None:
        raise HTTPException(status_code=404, detail="Tokenul nu a fost găsit")
    if token.revoked_at is None:
        token.revoked_at = datetime.now(UTC)
        await session.commit()


@router.get("/users/{username}", response_model=UserProfileRead)
async def get_user_profile(
    username: str,
    session: AsyncSession = Depends(get_session),
) -> UserProfileRead:
    """Profilul public al unui utilizator, inclusiv statisticile de duel."""
    user = await session.scalar(select(User).where(User.username == username))
    if user is None:
        raise HTTPException(status_code=404, detail="Utilizatorul nu a fost găsit")
    profile = UserProfileRead.model_validate(user)
    if not user.privacy_show_email:
        profile.email = None
    return profile
