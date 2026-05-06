from datetime import datetime, timezone

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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autentificare necesară")

    db_session = await session.scalar(
        select(DbSession).where(
            DbSession.token == reinfo_session,
            DbSession.expires_at > datetime.now(timezone.utc),
        )
    )
    if db_session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesiune invalidă sau expirată")

    user = await session.get(User, db_session.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilizator inexistent")

    user.last_active_at = datetime.now(timezone.utc)
    await session.commit()
    return user


def require_role(*roles: UserRole) -> User:
    """FastAPI dependency factory; returns a Depends that enforces role membership."""

    async def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permisiuni insuficiente")
        return user

    return Depends(_check)
