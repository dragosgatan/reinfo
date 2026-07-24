"""lesson management endpoints"""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.dependencies import get_current_user, get_optional_user
from app.models.lesson import Lesson, LessonCategory, LessonLevel, LessonProgress
from app.models.user import User, UserRole
from app.schemas.lesson import (
    LessonCreate,
    LessonListItem,
    LessonListResponse,
    LessonProgressRead,
    LessonRead,
    LessonUpdate,
)

router = APIRouter(prefix="/api/lessons", tags=["lessons"])


async def _get_lesson_or_404(slug: str, session: AsyncSession) -> Lesson:
    lesson = await session.scalar(select(Lesson).where(Lesson.slug == slug))
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lecția nu a fost găsită")
    return lesson


async def _is_completed(lesson_id: uuid.UUID, user: User | None, session: AsyncSession) -> bool:
    if user is None:
        return False
    return bool(
        await session.scalar(
            select(
                exists().where(
                    LessonProgress.lesson_id == lesson_id,
                    LessonProgress.user_id == user.id,
                )
            )
        )
    )


def _can_manage(user: User) -> bool:
    return user.role in (UserRole.teacher, UserRole.admin, UserRole.superuser)


def _lesson_to_read(lesson: Lesson, *, is_completed: bool, show_teacher_notes: bool) -> LessonRead:
    return LessonRead(
        id=lesson.id,
        slug=lesson.slug,
        title=lesson.title,
        category=lesson.category,
        level=lesson.level,
        content_md=lesson.content_md,
        content_md_en=lesson.content_md_en,
        content_md_hu=lesson.content_md_hu,
        teacher_notes_md=lesson.teacher_notes_md if show_teacher_notes else None,
        quizzes=lesson.quizzes or [],
        ordinal=lesson.ordinal,
        published=lesson.published,
        created_at=lesson.created_at,
        updated_at=lesson.updated_at,
        is_completed=is_completed,
    )


@router.get("", response_model=LessonListResponse)
async def list_lessons(
    category: LessonCategory | None = Query(None),
    level: LessonLevel | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> LessonListResponse:
    """list published lessons with optional filtering"""
    stmt = select(Lesson)

    is_manager = current_user is not None and _can_manage(current_user)
    if not is_manager:
        stmt = stmt.where(Lesson.published.is_(True))

    if category is not None:
        stmt = stmt.where(Lesson.category == category)
    if level is not None:
        stmt = stmt.where(Lesson.level == level)

    stmt = stmt.order_by(Lesson.ordinal.asc(), Lesson.created_at.asc())
    lessons = (await session.scalars(stmt)).all()

    items = []
    for lesson in lessons:
        completed = await _is_completed(lesson.id, current_user, session)
        items.append(
            LessonListItem(
                id=lesson.id,
                slug=lesson.slug,
                title=lesson.title,
                category=lesson.category,
                level=lesson.level,
                ordinal=lesson.ordinal,
                published=lesson.published,
                is_completed=completed,
            )
        )

    return LessonListResponse(items=items, total=len(items))


@router.get("/{slug}", response_model=LessonRead)
async def get_lesson(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> LessonRead:
    """full lesson details"""
    lesson = await _get_lesson_or_404(slug, session)

    is_manager = current_user is not None and _can_manage(current_user)
    if not lesson.published and not is_manager:
        raise HTTPException(status_code=404, detail="Lecția nu a fost găsită")

    completed = await _is_completed(lesson.id, current_user, session)
    show_teacher = current_user is not None and _can_manage(current_user)
    return _lesson_to_read(lesson, is_completed=completed, show_teacher_notes=show_teacher)


@router.post("", response_model=LessonRead, status_code=201)
async def create_lesson(
    data: LessonCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> LessonRead:
    """create a new lesson, requires the teacher or admin role"""
    if not _can_manage(current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    existing = await session.scalar(select(Lesson).where(Lesson.slug == data.slug))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Există deja o lecție cu acest slug")

    now = datetime.now(UTC)
    lesson = Lesson(
        **data.model_dump(),
        updated_at=now,
    )
    session.add(lesson)
    await session.commit()
    await session.refresh(lesson)
    return _lesson_to_read(lesson, is_completed=False, show_teacher_notes=True)


@router.patch("/{slug}", response_model=LessonRead)
async def update_lesson(
    slug: str,
    data: LessonUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> LessonRead:
    """edit a lesson, requires the teacher or admin role"""
    if not _can_manage(current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    lesson = await _get_lesson_or_404(slug, session)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(lesson, field, value)
    lesson.updated_at = datetime.now(UTC)

    await session.commit()
    await session.refresh(lesson)

    completed = await _is_completed(lesson.id, current_user, session)
    return _lesson_to_read(lesson, is_completed=completed, show_teacher_notes=True)


@router.delete("/{slug}", status_code=200)
async def delete_lesson(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """permanently delete a lesson, requires the admin role"""
    if current_user.role not in (UserRole.admin, UserRole.superuser):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    lesson = await _get_lesson_or_404(slug, session)
    await session.delete(lesson)
    await session.commit()
    return {"message": "Lecția a fost ștearsă"}


@router.post("/{slug}/complete", response_model=LessonProgressRead, status_code=201)
async def mark_complete(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> LessonProgressRead:
    """mark the lesson as completed for the current user"""
    lesson = await _get_lesson_or_404(slug, session)
    if not lesson.published and not _can_manage(current_user):
        raise HTTPException(status_code=404, detail="Lecția nu a fost găsită")

    existing = await session.scalar(
        select(LessonProgress).where(
            LessonProgress.lesson_id == lesson.id,
            LessonProgress.user_id == current_user.id,
        )
    )
    if existing is not None:
        return LessonProgressRead.model_validate(existing)

    progress = LessonProgress(
        user_id=current_user.id,
        lesson_id=lesson.id,
        completed_at=datetime.now(UTC),
    )
    session.add(progress)
    await session.commit()
    await session.refresh(progress)
    return LessonProgressRead.model_validate(progress)


@router.delete("/{slug}/complete", status_code=200)
async def unmark_complete(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """remove the completion mark"""
    lesson = await _get_lesson_or_404(slug, session)

    progress = await session.scalar(
        select(LessonProgress).where(
            LessonProgress.lesson_id == lesson.id,
            LessonProgress.user_id == current_user.id,
        )
    )
    if progress is None:
        raise HTTPException(status_code=404, detail="Nu există marcaj de finalizare")

    await session.delete(progress)
    await session.commit()
    return {"message": "Marcajul de finalizare a fost eliminat"}
