"""admin-only endpoints for user management and platform stats"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.dependencies import require_role
from app.models.contest import Contest
from app.models.problem import Problem
from app.models.submission import Submission
from app.models.user import User, UserRole
from app.schemas.user import (
    AdminBanUpdate,
    AdminRoleUpdate,
    AdminStats,
    AdminUserList,
    AdminUserRead,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])

_PRIVILEGED_ROLES = (UserRole.admin, UserRole.superuser)


@router.get("/stats", response_model=AdminStats)
async def get_stats(
    admin: User = require_role(*_PRIVILEGED_ROLES),
    session: AsyncSession = Depends(get_session),
) -> AdminStats:
    """return global platform stats"""
    total_users = await session.scalar(select(func.count(User.id))) or 0
    total_problems = await session.scalar(select(func.count(Problem.id))) or 0
    total_submissions = await session.scalar(select(func.count(Submission.id))) or 0
    total_contests = await session.scalar(select(func.count(Contest.id))) or 0

    role_rows = await session.execute(select(User.role, func.count(User.id)).group_by(User.role))
    users_by_role = {str(role): count for role, count in role_rows}

    return AdminStats(
        total_users=total_users,
        total_problems=total_problems,
        total_submissions=total_submissions,
        total_contests=total_contests,
        users_by_role=users_by_role,
    )


@router.get("/users", response_model=AdminUserList)
async def list_users(
    search: str = Query(default="", max_length=64),
    role: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    admin: User = require_role(*_PRIVILEGED_ROLES),
    session: AsyncSession = Depends(get_session),
) -> AdminUserList:
    """list all users with filtering and pagination"""
    q = select(User)
    if search:
        pattern = f"%{search}%"
        q = q.where(
            User.username.ilike(pattern)
            | User.email.ilike(pattern)
            | User.display_name.ilike(pattern)
        )
    if role in ("student", "teacher", "admin", "superuser"):
        q = q.where(User.role == role)

    total = await session.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = await session.execute(
        q.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit)
    )
    users = [AdminUserRead.model_validate(u) for u in rows.scalars()]
    return AdminUserList(total=total, users=users)


@router.patch("/users/{user_id}/role", response_model=AdminUserRead)
async def update_user_role(
    user_id: uuid.UUID,
    body: AdminRoleUpdate,
    admin: User = require_role(*_PRIVILEGED_ROLES),
    session: AsyncSession = Depends(get_session),
) -> AdminUserRead:
    """change a user's role; the superuser role cannot be assigned via the api"""
    if body.role == UserRole.superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Rolul superuser poate fi atribuit doar prin baza de date",
        )

    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilizator inexistent")
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nu îți poți schimba propriul rol",
        )
    if user.role == UserRole.superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Contul superuser nu poate fi modificat prin panou",
        )
    if admin.role != UserRole.superuser and (
        user.role == UserRole.admin or body.role == UserRole.admin
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doar superuserii pot gestiona rolul de admin",
        )

    user.role = body.role
    await session.commit()
    await session.refresh(user)
    return AdminUserRead.model_validate(user)


@router.patch("/users/{user_id}/ban", response_model=AdminUserRead)
async def update_user_ban(
    user_id: uuid.UUID,
    body: AdminBanUpdate,
    admin: User = require_role(*_PRIVILEGED_ROLES),
    session: AsyncSession = Depends(get_session),
) -> AdminUserRead:
    """suspend or reactivate an account"""
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilizator inexistent")
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nu te poți bana pe tine însuți",
        )
    if user.role == UserRole.superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Contul superuser nu poate fi suspendat",
        )
    if admin.role != UserRole.superuser and user.role == UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doar superuserii pot suspenda un admin",
        )

    user.is_banned = body.is_banned
    await session.commit()
    await session.refresh(user)
    return AdminUserRead.model_validate(user)
