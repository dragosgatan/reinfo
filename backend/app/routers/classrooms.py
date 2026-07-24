"""classroom endpoints: classes, announcements, assignments, group chat, dms"""

import json
import re
import secrets
import string
import unicodedata
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.dependencies import get_current_user
from app.models.classroom import (
    Class,
    ClassAnnouncement,
    ClassAssignment,
    ClassHomework,
    ClassMember,
    ClassMessage,
    DirectMessage,
)
from app.models.contest import Contest, ContestType, ScoringMode
from app.models.problem import Problem
from app.models.submission import Submission, Verdict
from app.models.user import User
from app.realtime import class_chat_hub, notification_hub, publish_class_message
from app.schemas.classroom import (
    AnnouncementCreate,
    AnnouncementRead,
    AnnouncementUpdate,
    AssignmentCreate,
    AssignmentRead,
    ClassCreate,
    ClassDetail,
    ClassMessageCreate,
    ClassMessageRead,
    ClassRead,
    ClassTestCreate,
    ClassTestRead,
    ClassUpdate,
    DirectMessageCreate,
    DirectMessageRead,
    DmThreadUnread,
    HomeworkCreate,
    HomeworkProgress,
    HomeworkRead,
    HomeworkUpdate,
    MemberRead,
    StudentProgress,
)

router = APIRouter(prefix="/api/classes", tags=["classes"])

_CODE_CHARS = string.ascii_uppercase + string.digits
_CODE_LEN = 8


def _gen_code() -> str:
    return "".join(secrets.choice(_CODE_CHARS) for _ in range(_CODE_LEN))


def _is_teacher(cls: Class, user: User) -> bool:
    return cls.teacher_id == user.id


async def _assert_member(cls: Class, user: User, session: AsyncSession) -> None:
    if _is_teacher(cls, user):
        return
    member = await session.scalar(
        select(ClassMember).where(ClassMember.class_id == cls.id, ClassMember.user_id == user.id)
    )
    if member is None:
        raise HTTPException(status_code=403, detail="Nu ești membru al acestei clase")


async def _get_class_or_404(class_id: uuid.UUID, session: AsyncSession) -> Class:
    cls = await session.get(Class, class_id)
    if cls is None:
        raise HTTPException(status_code=404, detail="Clasa nu a fost găsită")
    return cls


def _build_class_read(cls: Class, member_count: int) -> ClassRead:
    return ClassRead(
        id=cls.id,
        name=cls.name,
        description_md=cls.description_md,
        join_code=cls.join_code,
        archived=cls.archived,
        created_at=cls.created_at,
        teacher_id=cls.teacher_id,
        teacher_username=cls.teacher.username,
        teacher_display_name=cls.teacher.display_name,
        teacher_avatar_url=cls.teacher.avatar_url,
        member_count=member_count,
    )


def _build_announcement_read(ann: ClassAnnouncement) -> AnnouncementRead:
    return AnnouncementRead(
        id=ann.id,
        class_id=ann.class_id,
        author_id=ann.author_id,
        author_username=ann.author.username,
        author_display_name=ann.author.display_name,
        author_avatar_url=ann.author.avatar_url,
        title=ann.title,
        body_md=ann.body_md,
        pinned=ann.pinned,
        created_at=ann.created_at,
    )


def _build_message_read(msg: ClassMessage) -> ClassMessageRead:
    return ClassMessageRead(
        id=msg.id,
        class_id=msg.class_id,
        author_id=msg.author_id,
        author_username=msg.author.username,
        author_display_name=msg.author.display_name,
        author_avatar_url=msg.author.avatar_url,
        body=msg.body,
        created_at=msg.created_at,
    )


def _build_dm_read(dm: DirectMessage) -> DirectMessageRead:
    return DirectMessageRead(
        id=dm.id,
        class_id=dm.class_id,
        sender_id=dm.sender_id,
        sender_username=dm.sender.username,
        sender_display_name=dm.sender.display_name,
        sender_avatar_url=dm.sender.avatar_url,
        receiver_id=dm.receiver_id,
        body=dm.body,
        read=dm.read,
        created_at=dm.created_at,
    )


@router.post("", response_model=ClassRead, status_code=201)
async def create_class(
    data: ClassCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ClassRead:
    """create a new class (teachers and admins)"""
    from app.models.user import UserRole

    if user.role not in (UserRole.teacher, UserRole.admin, UserRole.superuser):
        raise HTTPException(status_code=403, detail="Doar profesorii pot crea clase")

    for _ in range(10):
        code = _gen_code()
        existing = await session.scalar(select(Class).where(Class.join_code == code))
        if existing is None:
            break
    else:
        raise HTTPException(status_code=500, detail="Nu s-a putut genera codul de invitație")

    cls = Class(
        name=data.name, description_md=data.description_md, join_code=code, teacher_id=user.id
    )
    session.add(cls)
    await session.commit()
    await session.refresh(cls, ["teacher"])
    return _build_class_read(cls, 0)


@router.get("", response_model=list[ClassRead])
async def list_classes(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ClassRead]:
    """list classes you're part of (as teacher or student)"""
    taught = await session.execute(
        select(Class).where(Class.teacher_id == user.id).order_by(Class.created_at.desc())
    )
    taught_classes = list(taught.scalars())

    memberships = await session.execute(
        select(ClassMember.class_id).where(ClassMember.user_id == user.id)
    )
    joined_ids = [r for (r,) in memberships]
    joined_classes: list[Class] = []
    if joined_ids:
        rows = await session.execute(
            select(Class).where(Class.id.in_(joined_ids)).order_by(Class.created_at.desc())
        )
        joined_classes = list(rows.scalars())

    all_classes = taught_classes + joined_classes

    result = []
    for cls in all_classes:
        await session.refresh(cls, ["teacher"])
        count = (
            await session.scalar(select(func.count()).where(ClassMember.class_id == cls.id))
        ) or 0
        result.append(_build_class_read(cls, count))
    return result


@router.post("/join", response_model=ClassRead)
async def join_class(
    join_code: str = Query(min_length=1, max_length=16),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ClassRead:
    """join a class using its invite code"""
    cls = await session.scalar(select(Class).where(Class.join_code == join_code.upper().strip()))
    if cls is None:
        raise HTTPException(status_code=404, detail="Codul de invitație nu este valid")

    if cls.teacher_id == user.id:
        raise HTTPException(status_code=400, detail="Ești deja profesorul acestei clase")

    existing = await session.scalar(
        select(ClassMember).where(ClassMember.class_id == cls.id, ClassMember.user_id == user.id)
    )
    if existing:
        raise HTTPException(status_code=400, detail="Ești deja membru al acestei clase")

    session.add(ClassMember(class_id=cls.id, user_id=user.id))
    await session.commit()
    await session.refresh(cls, ["teacher"])
    count = (await session.scalar(select(func.count()).where(ClassMember.class_id == cls.id))) or 0
    return _build_class_read(cls, count)


@router.get("/{class_id}", response_model=ClassDetail)
async def get_class(
    class_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ClassDetail:
    """full details of a class"""
    cls = await _get_class_or_404(class_id, session)
    await _assert_member(cls, user, session)
    await session.refresh(cls, ["teacher", "members"])

    count = (await session.scalar(select(func.count()).where(ClassMember.class_id == cls.id))) or 0

    member_rows = await session.execute(select(ClassMember).where(ClassMember.class_id == cls.id))
    members: list[MemberRead] = []
    for m in member_rows.scalars():
        await session.refresh(m, ["user"])
        members.append(
            MemberRead(
                id=m.user.id,
                username=m.user.username,
                display_name=m.user.display_name,
                avatar_url=m.user.avatar_url,
            )
        )

    base = _build_class_read(cls, count)
    return ClassDetail(**base.model_dump(), members=members)


@router.patch("/{class_id}", response_model=ClassRead)
async def update_class(
    class_id: uuid.UUID,
    data: ClassUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ClassRead:
    """update the class name/description/archived flag (teacher only)"""
    cls = await _get_class_or_404(class_id, session)
    if not _is_teacher(cls, user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    if data.name is not None:
        cls.name = data.name
    if data.description_md is not None:
        cls.description_md = data.description_md or None
    if data.archived is not None:
        cls.archived = data.archived

    await session.commit()
    await session.refresh(cls, ["teacher"])
    count = (await session.scalar(select(func.count()).where(ClassMember.class_id == cls.id))) or 0
    return _build_class_read(cls, count)


@router.post("/{class_id}/regenerate-code", response_model=ClassRead)
async def regenerate_code(
    class_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ClassRead:
    """regenerate the invite code (teacher only)"""
    cls = await _get_class_or_404(class_id, session)
    if not _is_teacher(cls, user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    for _ in range(10):
        code = _gen_code()
        existing = await session.scalar(
            select(Class).where(Class.join_code == code, Class.id != cls.id)
        )
        if existing is None:
            break
    else:
        raise HTTPException(status_code=500, detail="Nu s-a putut genera codul")

    cls.join_code = code
    await session.commit()
    await session.refresh(cls, ["teacher"])
    count = (await session.scalar(select(func.count()).where(ClassMember.class_id == cls.id))) or 0
    return _build_class_read(cls, count)


@router.delete("/{class_id}/leave", status_code=204)
async def leave_class(
    class_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """leave a class (student)"""
    cls = await _get_class_or_404(class_id, session)
    if _is_teacher(cls, user):
        raise HTTPException(status_code=400, detail="Profesorul nu poate părăsi propria clasă")

    await session.execute(
        delete(ClassMember).where(ClassMember.class_id == cls.id, ClassMember.user_id == user.id)
    )
    await session.commit()


@router.delete("/{class_id}/members/{member_id}", status_code=204)
async def kick_member(
    class_id: uuid.UUID,
    member_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """remove a student from the class (teacher only)"""
    cls = await _get_class_or_404(class_id, session)
    if not _is_teacher(cls, user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    await session.execute(
        delete(ClassMember).where(ClassMember.class_id == cls.id, ClassMember.user_id == member_id)
    )
    await session.commit()


@router.delete("/{class_id}", status_code=204)
async def delete_class(
    class_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """delete the class (teacher only)"""
    cls = await _get_class_or_404(class_id, session)
    if not _is_teacher(cls, user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    await session.delete(cls)
    await session.commit()


@router.get("/{class_id}/announcements", response_model=list[AnnouncementRead])
async def list_announcements(
    class_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[AnnouncementRead]:
    """list the class's announcements"""
    cls = await _get_class_or_404(class_id, session)
    await _assert_member(cls, user, session)

    rows = await session.execute(
        select(ClassAnnouncement)
        .where(ClassAnnouncement.class_id == class_id)
        .order_by(ClassAnnouncement.pinned.desc(), ClassAnnouncement.created_at.desc())
    )
    anns = rows.scalars().all()
    result = []
    for ann in anns:
        await session.refresh(ann, ["author"])
        result.append(_build_announcement_read(ann))
    return result


@router.post("/{class_id}/announcements", response_model=AnnouncementRead, status_code=201)
async def create_announcement(
    class_id: uuid.UUID,
    data: AnnouncementCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AnnouncementRead:
    """publish an announcement (teacher only)"""
    cls = await _get_class_or_404(class_id, session)
    if not _is_teacher(cls, user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    ann = ClassAnnouncement(
        class_id=class_id, author_id=user.id, title=data.title, body_md=data.body_md
    )
    session.add(ann)
    await session.commit()
    await session.refresh(ann, ["author"])
    return _build_announcement_read(ann)


@router.patch("/{class_id}/announcements/{ann_id}", response_model=AnnouncementRead)
async def update_announcement(
    class_id: uuid.UUID,
    ann_id: uuid.UUID,
    data: AnnouncementUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AnnouncementRead:
    """edit or pin an announcement (teacher only)"""
    cls = await _get_class_or_404(class_id, session)
    if not _is_teacher(cls, user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    ann = await session.scalar(
        select(ClassAnnouncement).where(
            ClassAnnouncement.id == ann_id, ClassAnnouncement.class_id == class_id
        )
    )
    if ann is None:
        raise HTTPException(status_code=404, detail="Anunțul nu a fost găsit")

    if data.title is not None:
        ann.title = data.title
    if data.body_md is not None:
        ann.body_md = data.body_md
    if data.pinned is not None:
        ann.pinned = data.pinned

    await session.commit()
    await session.refresh(ann, ["author"])
    return _build_announcement_read(ann)


@router.delete("/{class_id}/announcements/{ann_id}", status_code=204)
async def delete_announcement(
    class_id: uuid.UUID,
    ann_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """delete an announcement (teacher only)"""
    cls = await _get_class_or_404(class_id, session)
    if not _is_teacher(cls, user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    ann = await session.scalar(
        select(ClassAnnouncement).where(
            ClassAnnouncement.id == ann_id, ClassAnnouncement.class_id == class_id
        )
    )
    if ann is None:
        raise HTTPException(status_code=404, detail="Anunțul nu a fost găsit")

    await session.delete(ann)
    await session.commit()


async def _build_assignment_read(a: ClassAssignment, solved_ids: set[uuid.UUID]) -> AssignmentRead:
    """build assignmentread from a loaded classassignment (problem must be refreshed)"""
    return AssignmentRead(
        id=a.id,
        class_id=a.class_id,
        homework_id=a.homework_id,
        problem_id=a.problem_id,
        problem_slug=a.problem.slug,
        problem_title=a.problem.title,
        problem_difficulty=a.problem.difficulty,
        note_md=a.note_md,
        due_at=a.due_at,
        created_at=a.created_at,
        user_solved=a.problem_id in solved_ids,
    )


async def _fetch_solved_ids(
    user_id: uuid.UUID, problem_ids: list[uuid.UUID], session: AsyncSession
) -> set[uuid.UUID]:
    if not problem_ids:
        return set()
    rows = await session.execute(
        select(Submission.problem_id)
        .where(
            Submission.user_id == user_id,
            Submission.problem_id.in_(problem_ids),
            Submission.verdict == Verdict.AC,
        )
        .distinct()
    )
    return {r[0] for r in rows}


@router.get("/{class_id}/assignments", response_model=list[AssignmentRead])
async def list_assignments(
    class_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[AssignmentRead]:
    """list assigned problems (includes homework_id for client-side grouping)"""
    cls = await _get_class_or_404(class_id, session)
    await _assert_member(cls, user, session)

    rows = await session.execute(
        select(ClassAssignment)
        .where(ClassAssignment.class_id == class_id)
        .order_by(ClassAssignment.created_at.desc())
    )
    assignments = rows.scalars().all()
    for a in assignments:
        await session.refresh(a, ["problem"])

    solved_ids = await _fetch_solved_ids(user.id, [a.problem_id for a in assignments], session)
    return [await _build_assignment_read(a, solved_ids) for a in assignments]


@router.post("/{class_id}/assignments", response_model=AssignmentRead, status_code=201)
async def create_assignment(
    class_id: uuid.UUID,
    data: AssignmentCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AssignmentRead:
    """assign a single problem to the class (teacher only)"""
    cls = await _get_class_or_404(class_id, session)
    if not _is_teacher(cls, user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    problem = await session.scalar(select(Problem).where(Problem.slug == data.problem_slug))
    if problem is None:
        raise HTTPException(status_code=404, detail="Problema nu a fost găsită")

    existing = await session.scalar(
        select(ClassAssignment).where(
            ClassAssignment.class_id == class_id, ClassAssignment.problem_id == problem.id
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Problema este deja atribuită")

    a = ClassAssignment(
        class_id=class_id,
        problem_id=problem.id,
        homework_id=None,
        note_md=data.note_md,
        due_at=data.due_at,
    )
    session.add(a)
    await session.commit()
    await session.refresh(a, ["problem"])
    return await _build_assignment_read(a, set())


@router.delete("/{class_id}/assignments/{assignment_id}", status_code=204)
async def delete_assignment(
    class_id: uuid.UUID,
    assignment_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """delete an assigned problem (teacher only)"""
    cls = await _get_class_or_404(class_id, session)
    if not _is_teacher(cls, user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    a = await session.scalar(
        select(ClassAssignment).where(
            ClassAssignment.id == assignment_id, ClassAssignment.class_id == class_id
        )
    )
    if a is None:
        raise HTTPException(status_code=404, detail="Atribuirea nu a fost găsită")

    await session.delete(a)
    await session.commit()


@router.post("/{class_id}/homework", response_model=HomeworkRead, status_code=201)
async def create_homework(
    class_id: uuid.UUID,
    data: HomeworkCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> HomeworkRead:
    """create a homework group with the given problems (teacher only)"""
    cls = await _get_class_or_404(class_id, session)
    if not _is_teacher(cls, user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    hw = ClassHomework(
        class_id=class_id,
        title=data.title,
        description_md=data.description_md,
        due_at=data.due_at,
    )
    session.add(hw)
    await session.flush()

    created: list[tuple[ClassAssignment, Problem]] = []
    for slug in data.problem_slugs:
        slug = slug.strip()
        problem = await session.scalar(select(Problem).where(Problem.slug == slug))
        if problem is None:
            await session.rollback()
            raise HTTPException(status_code=404, detail=f"Problema '{slug}' nu a fost găsită")

        existing = await session.scalar(
            select(ClassAssignment).where(
                ClassAssignment.class_id == class_id,
                ClassAssignment.problem_id == problem.id,
            )
        )
        if existing:
            await session.rollback()
            raise HTTPException(
                status_code=400, detail=f"Problema '{slug}' este deja atribuită clasei"
            )

        a = ClassAssignment(
            class_id=class_id,
            problem_id=problem.id,
            homework_id=hw.id,
            note_md=None,
            due_at=data.due_at,
        )
        session.add(a)
        await session.flush()
        created.append((a, problem))

    await session.commit()

    return HomeworkRead(
        id=hw.id,
        class_id=hw.class_id,
        title=hw.title,
        description_md=hw.description_md,
        due_at=hw.due_at,
        created_at=hw.created_at,
        assignments=[
            AssignmentRead(
                id=a.id,
                class_id=a.class_id,
                homework_id=hw.id,
                problem_id=p.id,
                problem_slug=p.slug,
                problem_title=p.title,
                problem_difficulty=p.difficulty,
                note_md=a.note_md,
                due_at=a.due_at,
                created_at=a.created_at,
                user_solved=False,
            )
            for a, p in created
        ],
    )


@router.get("/{class_id}/homework", response_model=list[HomeworkRead])
async def list_homework(
    class_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[HomeworkRead]:
    """list homework groups with their problems and the user's solve status"""
    cls = await _get_class_or_404(class_id, session)
    await _assert_member(cls, user, session)

    hw_rows = await session.execute(
        select(ClassHomework)
        .where(ClassHomework.class_id == class_id)
        .order_by(ClassHomework.created_at.desc())
    )
    homeworks = hw_rows.scalars().all()
    if not homeworks:
        return []

    hw_ids = [hw.id for hw in homeworks]
    assign_rows = await session.execute(
        select(ClassAssignment)
        .where(ClassAssignment.homework_id.in_(hw_ids))
        .order_by(ClassAssignment.created_at.asc())
    )
    assignments = assign_rows.scalars().all()
    for a in assignments:
        await session.refresh(a, ["problem"])

    solved_ids = await _fetch_solved_ids(user.id, [a.problem_id for a in assignments], session)

    by_hw: dict[uuid.UUID, list[AssignmentRead]] = {}
    for a in assignments:
        ar = await _build_assignment_read(a, solved_ids)
        by_hw.setdefault(a.homework_id, []).append(ar)

    return [
        HomeworkRead(
            id=hw.id,
            class_id=hw.class_id,
            title=hw.title,
            description_md=hw.description_md,
            due_at=hw.due_at,
            created_at=hw.created_at,
            assignments=by_hw.get(hw.id, []),
        )
        for hw in homeworks
    ]


@router.patch("/{class_id}/homework/{homework_id}", response_model=HomeworkRead)
async def update_homework(
    class_id: uuid.UUID,
    homework_id: uuid.UUID,
    data: HomeworkUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> HomeworkRead:
    """update a homework group's title / description / deadline (teacher only)"""
    cls = await _get_class_or_404(class_id, session)
    if not _is_teacher(cls, user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    hw = await session.scalar(
        select(ClassHomework).where(
            ClassHomework.id == homework_id, ClassHomework.class_id == class_id
        )
    )
    if hw is None:
        raise HTTPException(status_code=404, detail="Tema nu a fost găsită")

    if data.title is not None:
        hw.title = data.title
    if data.description_md is not None:
        hw.description_md = data.description_md
    if data.due_at is not None:
        hw.due_at = data.due_at

    await session.commit()

    assign_rows = await session.execute(
        select(ClassAssignment)
        .where(ClassAssignment.homework_id == hw.id)
        .order_by(ClassAssignment.created_at.asc())
    )
    assignments = assign_rows.scalars().all()
    for a in assignments:
        await session.refresh(a, ["problem"])
    solved_ids = await _fetch_solved_ids(user.id, [a.problem_id for a in assignments], session)

    return HomeworkRead(
        id=hw.id,
        class_id=hw.class_id,
        title=hw.title,
        description_md=hw.description_md,
        due_at=hw.due_at,
        created_at=hw.created_at,
        assignments=[await _build_assignment_read(a, solved_ids) for a in assignments],
    )


@router.delete("/{class_id}/homework/{homework_id}", status_code=204)
async def delete_homework(
    class_id: uuid.UUID,
    homework_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """delete a homework group and all its problems (teacher only)"""
    cls = await _get_class_or_404(class_id, session)
    if not _is_teacher(cls, user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    hw = await session.scalar(
        select(ClassHomework).where(
            ClassHomework.id == homework_id, ClassHomework.class_id == class_id
        )
    )
    if hw is None:
        raise HTTPException(status_code=404, detail="Tema nu a fost găsită")

    await session.delete(hw)
    await session.commit()


@router.post(
    "/{class_id}/homework/{homework_id}/problems",
    response_model=AssignmentRead,
    status_code=201,
)
async def add_problem_to_homework(
    class_id: uuid.UUID,
    homework_id: uuid.UUID,
    data: AssignmentCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AssignmentRead:
    """add a problem to an existing homework group (teacher only)"""
    cls = await _get_class_or_404(class_id, session)
    if not _is_teacher(cls, user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    hw = await session.scalar(
        select(ClassHomework).where(
            ClassHomework.id == homework_id, ClassHomework.class_id == class_id
        )
    )
    if hw is None:
        raise HTTPException(status_code=404, detail="Tema nu a fost găsită")

    problem = await session.scalar(select(Problem).where(Problem.slug == data.problem_slug))
    if problem is None:
        raise HTTPException(status_code=404, detail="Problema nu a fost găsită")

    existing = await session.scalar(
        select(ClassAssignment).where(
            ClassAssignment.class_id == class_id, ClassAssignment.problem_id == problem.id
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Problema este deja atribuită clasei")

    a = ClassAssignment(
        class_id=class_id,
        problem_id=problem.id,
        homework_id=hw.id,
        note_md=data.note_md,
        due_at=data.due_at or hw.due_at,
    )
    session.add(a)
    await session.commit()
    await session.refresh(a, ["problem"])
    return await _build_assignment_read(a, set())


@router.get("/{class_id}/homework/{homework_id}/progress", response_model=HomeworkProgress)
async def homework_progress(
    class_id: uuid.UUID,
    homework_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> HomeworkProgress:
    """student progress for a homework group (teacher only)"""
    cls = await _get_class_or_404(class_id, session)
    if not _is_teacher(cls, user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    hw = await session.scalar(
        select(ClassHomework).where(
            ClassHomework.id == homework_id, ClassHomework.class_id == class_id
        )
    )
    if hw is None:
        raise HTTPException(status_code=404, detail="Tema nu a fost găsită")

    assign_rows = await session.execute(
        select(ClassAssignment)
        .where(ClassAssignment.homework_id == homework_id)
        .order_by(ClassAssignment.created_at.asc())
    )
    assignments = assign_rows.scalars().all()
    for a in assignments:
        await session.refresh(a, ["problem"])

    problem_ids = [a.problem_id for a in assignments]

    member_rows = await session.execute(select(ClassMember).where(ClassMember.class_id == class_id))
    members = member_rows.scalars().all()
    for m in members:
        await session.refresh(m, ["user"])

    member_ids = [m.user_id for m in members]

    solved_map: dict[uuid.UUID, set[uuid.UUID]] = {}
    if problem_ids and member_ids:
        sub_rows = await session.execute(
            select(Submission.user_id, Submission.problem_id)
            .where(
                Submission.user_id.in_(member_ids),
                Submission.problem_id.in_(problem_ids),
                Submission.verdict == Verdict.AC,
            )
            .distinct()
        )
        for uid, pid in sub_rows:
            solved_map.setdefault(uid, set()).add(pid)

    hw_read = HomeworkRead(
        id=hw.id,
        class_id=hw.class_id,
        title=hw.title,
        description_md=hw.description_md,
        due_at=hw.due_at,
        created_at=hw.created_at,
        assignments=[await _build_assignment_read(a, set()) for a in assignments],
    )

    members_progress = [
        StudentProgress(
            student_id=m.user_id,
            student_username=m.user.username,
            student_display_name=m.user.display_name,
            student_avatar_url=m.user.avatar_url,
            solved_problem_ids=list(solved_map.get(m.user_id, set())),
        )
        for m in members
    ]

    return HomeworkProgress(homework=hw_read, members=members_progress)


@router.get("/{class_id}/messages", response_model=list[ClassMessageRead])
async def list_messages(
    class_id: uuid.UUID,
    before: datetime | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ClassMessageRead]:
    """group chat history (cursor pagination)"""
    cls = await _get_class_or_404(class_id, session)
    await _assert_member(cls, user, session)

    stmt = select(ClassMessage).where(ClassMessage.class_id == class_id)
    if before:
        stmt = stmt.where(ClassMessage.created_at < before)
    stmt = stmt.order_by(ClassMessage.created_at.desc()).limit(limit)

    rows = await session.execute(stmt)
    msgs = rows.scalars().all()

    result = []
    for msg in msgs:
        await session.refresh(msg, ["author"])
        result.append(_build_message_read(msg))
    return list(reversed(result))


@router.post("/{class_id}/messages", response_model=ClassMessageRead, status_code=201)
async def send_message(
    class_id: uuid.UUID,
    data: ClassMessageCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ClassMessageRead:
    """send a message in the class chat"""
    cls = await _get_class_or_404(class_id, session)
    await _assert_member(cls, user, session)

    now = datetime.now(UTC)
    msg = ClassMessage(class_id=class_id, author_id=user.id, body=data.body, created_at=now)
    session.add(msg)
    await session.flush()

    msg_read = ClassMessageRead(
        id=msg.id,
        class_id=class_id,
        author_id=user.id,
        author_username=user.username,
        author_display_name=user.display_name,
        author_avatar_url=user.avatar_url,
        body=data.body,
        created_at=now,
    )
    await publish_class_message(
        session, str(class_id), json.dumps(msg_read.model_dump(mode="json"))
    )
    await session.commit()
    return msg_read


@router.websocket("/{class_id}/ws")
async def class_chat_ws(
    class_id: uuid.UUID,
    websocket: WebSocket,
    session: AsyncSession = Depends(get_session),
) -> None:
    """websocket for the class's realtime chat"""
    from app.dependencies import SESSION_COOKIE_NAME
    from app.models.user import Session as DbSession

    token = websocket.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        await websocket.close(code=4401)
        return

    db_session = await session.scalar(
        select(DbSession).where(
            DbSession.token == token,
            DbSession.expires_at > datetime.now(UTC),
        )
    )
    if db_session is None:
        await websocket.close(code=4401)
        return

    user = await session.get(User, db_session.user_id)
    if user is None:
        await websocket.close(code=4401)
        return

    cls = await session.get(Class, class_id)
    if cls is None:
        await websocket.close(code=4404)
        return

    is_member = _is_teacher(cls, user) or bool(
        await session.scalar(
            select(ClassMember).where(
                ClassMember.class_id == class_id, ClassMember.user_id == user.id
            )
        )
    )
    if not is_member:
        await websocket.close(code=4403)
        return

    await websocket.accept()
    key = str(class_id)
    await class_chat_hub.connect(key, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await class_chat_hub.disconnect(key, websocket)


@router.get("/{class_id}/dm/{username}", response_model=list[DirectMessageRead])
async def get_dm_thread(
    class_id: uuid.UUID,
    username: str,
    limit: int = Query(50, ge=1, le=100),
    before: datetime | None = Query(None),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[DirectMessageRead]:
    """private message history with a user in the class"""
    cls = await _get_class_or_404(class_id, session)
    await _assert_member(cls, user, session)

    other = await session.scalar(select(User).where(User.username == username))
    if other is None:
        raise HTTPException(status_code=404, detail="Utilizatorul nu a fost găsit")

    stmt = select(DirectMessage).where(
        DirectMessage.class_id == class_id,
        (
            (DirectMessage.sender_id == user.id) & (DirectMessage.receiver_id == other.id)
            | (DirectMessage.sender_id == other.id) & (DirectMessage.receiver_id == user.id)
        ),
    )
    if before:
        stmt = stmt.where(DirectMessage.created_at < before)
    stmt = stmt.order_by(DirectMessage.created_at.desc()).limit(limit)

    rows = await session.execute(stmt)
    dms = list(reversed(rows.scalars().all()))

    for dm in dms:
        if dm.receiver_id == user.id and not dm.read:
            dm.read = True
    await session.commit()

    result = []
    for dm in dms:
        await session.refresh(dm, ["sender"])
        result.append(_build_dm_read(dm))
    return result


@router.post("/{class_id}/dm/{username}", response_model=DirectMessageRead, status_code=201)
async def send_dm(
    class_id: uuid.UUID,
    username: str,
    data: DirectMessageCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DirectMessageRead:
    """send a private message to a user in the class"""
    cls = await _get_class_or_404(class_id, session)
    await _assert_member(cls, user, session)

    other = await session.scalar(select(User).where(User.username == username))
    if other is None:
        raise HTTPException(status_code=404, detail="Utilizatorul nu a fost găsit")

    await _assert_member(cls, other, session)

    now = datetime.now(UTC)
    dm = DirectMessage(
        class_id=class_id,
        sender_id=user.id,
        receiver_id=other.id,
        body=data.body,
        created_at=now,
    )
    session.add(dm)
    await session.flush()

    dm_payload = {
        "type": "dm",
        "id": str(dm.id),
        "class_id": str(class_id),
        "class_name": cls.name,
        "sender_id": str(user.id),
        "sender_username": user.username,
        "sender_display_name": user.display_name,
        "sender_avatar_url": user.avatar_url,
        "receiver_id": str(other.id),
        "body": data.body,
        "read": False,
        "created_at": now.isoformat(),
    }
    await notification_hub.send(str(other.id), dm_payload)

    await session.commit()

    dm_read = DirectMessageRead(
        id=dm.id,
        class_id=class_id,
        sender_id=user.id,
        sender_username=user.username,
        sender_display_name=user.display_name,
        sender_avatar_url=user.avatar_url,
        receiver_id=other.id,
        body=data.body,
        read=False,
        created_at=now,
    )
    return dm_read


def _slugify_test(text: str) -> str:
    slug = unicodedata.normalize("NFKD", text)
    slug = slug.encode("ascii", "ignore").decode("ascii")
    slug = slug.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    return slug.strip("-")[:128] or "test"


def _test_status(now: datetime, start: datetime, end: datetime) -> str:
    if now < start:
        return "upcoming"
    if now <= end:
        return "ongoing"
    return "past"


def _build_test_read(contest: Contest) -> ClassTestRead:
    from app.schemas.contest import contest_status

    now = datetime.now(UTC)
    return ClassTestRead(
        id=contest.id,
        slug=contest.slug,
        title=contest.title,
        description_md=contest.description_md,
        start_time=contest.start_time,
        end_time=contest.end_time,
        status=contest_status(now, contest.start_time, contest.end_time),
        problem_count=len(contest.contest_problems),
        participant_count=len(contest.participants),
        fullscreen_required=contest.fullscreen_required,
        copy_paste_blocked=contest.copy_paste_blocked,
    )


@router.get("/{class_id}/tests", response_model=list[ClassTestRead])
async def list_class_tests(
    class_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ClassTestRead]:
    """list tests created for this class (visible to members)"""
    from sqlalchemy.orm import selectinload

    cls = await _get_class_or_404(class_id, session)
    await _assert_member(cls, user, session)

    rows = await session.scalars(
        select(Contest)
        .where(Contest.class_id == class_id, Contest.contest_type == ContestType.class_test)
        .options(
            selectinload(Contest.contest_problems),
            selectinload(Contest.participants),
        )
        .order_by(Contest.start_time.desc())
    )
    return [_build_test_read(c) for c in rows]


@router.post("/{class_id}/tests", response_model=ClassTestRead, status_code=201)
async def create_class_test(
    class_id: uuid.UUID,
    data: ClassTestCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ClassTestRead:
    """create a test for the class (teacher only)"""
    from sqlalchemy.orm import selectinload

    cls = await _get_class_or_404(class_id, session)
    if not _is_teacher(cls, user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    base_slug = _slugify_test(data.title)
    slug = base_slug
    counter = 1
    while await session.scalar(select(Contest).where(Contest.slug == slug)):
        slug = f"{base_slug}-{counter}"
        counter += 1

    contest = Contest(
        slug=slug,
        title=data.title,
        description_md=data.description_md,
        start_time=data.start_time,
        end_time=data.end_time,
        scoring_mode=ScoringMode.test,
        contest_type=ContestType.class_test,
        created_by=user.id,
        class_id=class_id,
        is_public=False,
        fullscreen_required=data.fullscreen_required,
        copy_paste_blocked=data.copy_paste_blocked,
    )
    session.add(contest)
    await session.commit()

    contest = await session.scalar(
        select(Contest)
        .where(Contest.slug == slug)
        .options(
            selectinload(Contest.contest_problems),
            selectinload(Contest.participants),
        )
    )
    return _build_test_read(contest)


@router.delete("/{class_id}/tests/{contest_slug}", status_code=204)
async def delete_class_test(
    class_id: uuid.UUID,
    contest_slug: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """delete a class test (teacher only)"""
    cls = await _get_class_or_404(class_id, session)
    if not _is_teacher(cls, user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    contest = await session.scalar(
        select(Contest).where(
            Contest.slug == contest_slug,
            Contest.class_id == class_id,
            Contest.contest_type == ContestType.class_test,
        )
    )
    if contest is None:
        raise HTTPException(status_code=404, detail="Testul nu a fost găsit")

    await session.delete(contest)
    await session.commit()


@router.get("/dms/unread", response_model=list[DmThreadUnread])
async def get_unread_dms(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[DmThreadUnread]:
    """count of unread dms per class and sender"""
    rows = await session.execute(
        select(
            DirectMessage.class_id,
            DirectMessage.sender_id,
            func.count().label("cnt"),
        )
        .where(DirectMessage.receiver_id == user.id, DirectMessage.read.is_(False))
        .group_by(DirectMessage.class_id, DirectMessage.sender_id)
    )

    result = []
    for class_id, sender_id, cnt in rows:
        sender = await session.get(User, sender_id)
        if sender:
            result.append(
                DmThreadUnread(
                    class_id=class_id,
                    other_username=sender.username,
                    unread_count=cnt,
                )
            )
    return result
