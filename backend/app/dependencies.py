from datetime import UTC, datetime

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.user import Session as DbSession
from app.models.user import User, UserRole

SESSION_COOKIE_NAME = "reinfo_session"
SESSION_EXPIRY_DAYS = 30


async def get_current_user(
    reinfo_session: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
) -> User:
    if not reinfo_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Autentificare necesară"
        )

    db_session = await session.scalar(
        select(DbSession).where(
            DbSession.token == reinfo_session,
            DbSession.expires_at > datetime.now(UTC),
        )
    )
    if db_session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesiune invalidă sau expirată"
        )

    user = await session.get(User, db_session.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilizator inexistent"
        )

    if user.is_banned:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cont suspendat")
    user.last_active_at = datetime.now(UTC)
    await session.commit()
    return user


async def get_optional_user(
    reinfo_session: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
) -> User | None:
    """Like get_current_user but returns None for unauthenticated requests."""
    if not reinfo_session:
        return None
    db_session = await session.scalar(
        select(DbSession).where(
            DbSession.token == reinfo_session,
            DbSession.expires_at > datetime.now(UTC),
        )
    )
    if db_session is None:
        return None
    return await session.get(User, db_session.user_id)


def require_role(*roles: UserRole) -> User:
    """FastAPI dependency factory; returns a Depends that enforces role membership."""

    async def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Permisiuni insuficiente"
            )
        return user

    return Depends(_check)
