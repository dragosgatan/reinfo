from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.dependencies import SESSION_COOKIE_NAME, SESSION_EXPIRY_DAYS, get_current_user
from app.limiter import limiter
from app.models.user import Session as DbSession
from app.models.user import User
from app.schemas.user import LoginRequest, UserCreate, UserProfileRead, UserRead
from app.security import generate_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

_COOKIE_MAX_AGE = SESSION_EXPIRY_DAYS * 24 * 3600


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


@router.get("/me")
async def me(user: User = Depends(get_current_user)) -> UserRead:
    """Returnează datele utilizatorului autentificat curent."""
    return UserRead.model_validate(user)


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
