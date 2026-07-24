"""project endpoints: teacher-assigned open-ended projects with github submissions"""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.dependencies import get_current_user, get_optional_user
from app.github_integration import get_repo_info, parse_repo_url
from app.models.classroom import Class, ClassMember
from app.models.project import Project, ProjectGrade, ProjectSubmission
from app.models.user import User, UserRole
from app.schemas.project import (
    ProjectCreate,
    ProjectDetail,
    ProjectGradeCreate,
    ProjectGradeRead,
    ProjectListResponse,
    ProjectSubmissionCreate,
    ProjectSubmissionListResponse,
    ProjectSubmissionRead,
    ProjectSummary,
    ProjectUpdate,
    RepoInfoRead,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _can_author(user: User) -> bool:
    return user.role in (UserRole.teacher, UserRole.admin, UserRole.superuser)


def _can_edit(project: Project, user: User) -> bool:
    return user.role in (UserRole.admin, UserRole.superuser) or project.teacher_id == user.id


async def _get_project_or_404(slug: str, session: AsyncSession) -> Project:
    project = await session.scalar(select(Project).where(Project.slug == slug))
    if project is None:
        raise HTTPException(status_code=404, detail="Proiectul nu a fost găsit")
    return project


async def _can_view_project(project: Project, user: User | None, session: AsyncSession) -> bool:
    if user is not None and _can_edit(project, user):
        return True
    if not project.published:
        return False
    if project.class_id is None:
        return True
    if user is None:
        return False
    cls = await session.get(Class, project.class_id)
    if cls is not None and cls.teacher_id == user.id:
        return True
    member = await session.scalar(
        select(ClassMember).where(
            ClassMember.class_id == project.class_id, ClassMember.user_id == user.id
        )
    )
    return member is not None


async def _visible_class_ids(user: User, session: AsyncSession) -> set[uuid.UUID]:
    member_rows = (
        await session.execute(select(ClassMember.class_id).where(ClassMember.user_id == user.id))
    ).all()
    teach_rows = (await session.execute(select(Class.id).where(Class.teacher_id == user.id))).all()
    return {r[0] for r in member_rows} | {r[0] for r in teach_rows}


async def _submission_to_read(
    session: AsyncSession, submission: ProjectSubmission, *, with_repo_info: bool
) -> ProjectSubmissionRead:
    student = await session.get(User, submission.student_id)
    grade_read = None
    if submission.grade is not None:
        grader = (
            await session.get(User, submission.grade.grader_id)
            if submission.grade.grader_id
            else None
        )
        grade_read = ProjectGradeRead(
            score=submission.grade.score,
            feedback_md=submission.grade.feedback_md,
            graded_at=submission.grade.graded_at,
            grader_username=grader.username if grader else None,
        )

    repo_info_read = None
    if with_repo_info:
        cache = await get_repo_info(session, submission.repo_url)
        if cache is not None:
            repo_info_read = RepoInfoRead(
                ok=cache.ok,
                error_reason=cache.error_reason,
                language=cache.language,
                stars=cache.stars,
                last_commit_at=cache.last_commit_at,
                commit_count_approx=cache.commit_count_approx,
                readme_md=cache.readme_md,
            )

    return ProjectSubmissionRead(
        id=submission.id,
        project_id=submission.project_id,
        student_id=submission.student_id,
        student_username=student.username if student else "",
        repo_url=submission.repo_url,
        notes_md=submission.notes_md,
        submitted_at=submission.submitted_at,
        last_updated_at=submission.last_updated_at,
        grade=grade_read,
        repo_info=repo_info_read,
    )


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> ProjectListResponse:
    """list projects visible to the current user"""
    stmt = select(Project).options(selectinload(Project.submissions))
    projects = (await session.scalars(stmt.order_by(Project.created_at.desc()))).all()

    visible_class_ids: set[uuid.UUID] = set()
    is_admin = current_user is not None and current_user.role in (
        UserRole.admin,
        UserRole.superuser,
    )
    if current_user is not None and not is_admin:
        visible_class_ids = await _visible_class_ids(current_user, session)

    items: list[ProjectSummary] = []
    for project in projects:
        is_own = current_user is not None and project.teacher_id == current_user.id
        if not (
            is_admin
            or is_own
            or (
                project.published
                and (project.class_id is None or project.class_id in visible_class_ids)
            )
        ):
            continue

        cls = await session.get(Class, project.class_id) if project.class_id else None
        teacher = await session.get(User, project.teacher_id) if project.teacher_id else None
        my_submission_id = None
        if current_user is not None:
            my_submission_id = next(
                (s.id for s in project.submissions if s.student_id == current_user.id), None
            )

        items.append(
            ProjectSummary(
                id=project.id,
                slug=project.slug,
                title=project.title,
                class_id=project.class_id,
                class_name=cls.name if cls else None,
                teacher_id=project.teacher_id,
                teacher_username=teacher.username if teacher else None,
                deadline=project.deadline,
                published=project.published,
                submission_count=len(project.submissions),
                my_submission_id=my_submission_id,
            )
        )

    return ProjectListResponse(items=items, total=len(items))


@router.get("/{slug}", response_model=ProjectDetail)
async def get_project(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> ProjectDetail:
    """project details, including the brief and your own submission (if any)"""
    project = await session.scalar(
        select(Project)
        .where(Project.slug == slug)
        .options(selectinload(Project.submissions).selectinload(ProjectSubmission.grade))
    )
    if project is None or not await _can_view_project(project, current_user, session):
        raise HTTPException(status_code=404, detail="Proiectul nu a fost găsit")

    cls = await session.get(Class, project.class_id) if project.class_id else None
    teacher = await session.get(User, project.teacher_id) if project.teacher_id else None

    my_submission_read = None
    my_submission_id = None
    if current_user is not None:
        mine = next((s for s in project.submissions if s.student_id == current_user.id), None)
        if mine is not None:
            my_submission_id = mine.id
            my_submission_read = await _submission_to_read(session, mine, with_repo_info=True)

    return ProjectDetail(
        id=project.id,
        slug=project.slug,
        title=project.title,
        class_id=project.class_id,
        class_name=cls.name if cls else None,
        teacher_id=project.teacher_id,
        teacher_username=teacher.username if teacher else None,
        deadline=project.deadline,
        published=project.published,
        submission_count=len(project.submissions),
        my_submission_id=my_submission_id,
        brief_md=project.brief_md,
        my_submission=my_submission_read,
    )


@router.post("", response_model=ProjectDetail, status_code=201)
async def create_project(
    data: ProjectCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProjectDetail:
    """create a new project, requires the teacher or admin role"""
    if not _can_author(current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    existing = await session.scalar(select(Project).where(Project.slug == data.slug))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Există deja un proiect cu acest slug")

    if data.class_id is not None:
        cls = await session.get(Class, data.class_id)
        if cls is None:
            raise HTTPException(status_code=400, detail="Clasa nu a fost găsită")

    project = Project(**data.model_dump(), teacher_id=current_user.id)
    session.add(project)
    await session.commit()
    await session.refresh(project)

    return ProjectDetail(
        id=project.id,
        slug=project.slug,
        title=project.title,
        class_id=project.class_id,
        class_name=None,
        teacher_id=project.teacher_id,
        teacher_username=current_user.username,
        deadline=project.deadline,
        published=project.published,
        submission_count=0,
        brief_md=project.brief_md,
        my_submission=None,
    )


@router.patch("/{slug}", response_model=ProjectDetail)
async def update_project(
    slug: str,
    data: ProjectUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProjectDetail:
    """edit a project, the teacher who created it or an admin"""
    project = await _get_project_or_404(slug, session)
    if not _can_edit(project, current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    await session.commit()

    return await get_project(slug, session, current_user)


@router.delete("/{slug}", status_code=200)
async def delete_project(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """permanently delete a project, the teacher who created it or an admin"""
    project = await _get_project_or_404(slug, session)
    if not _can_edit(project, current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    await session.delete(project)
    await session.commit()
    return {"message": "Proiectul a fost șters"}


@router.post("/{slug}/submissions", response_model=ProjectSubmissionRead, status_code=201)
async def submit_or_resubmit(
    slug: str,
    data: ProjectSubmissionCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProjectSubmissionRead:
    """submit or update your own submission for a project, blocked after the deadline"""
    project = await _get_project_or_404(slug, session)
    if not await _can_view_project(project, current_user, session):
        raise HTTPException(status_code=404, detail="Proiectul nu a fost găsit")

    if parse_repo_url(data.repo_url) is None:
        raise HTTPException(
            status_code=422, detail="Link invalid - trebuie să fie un URL GitHub valid"
        )

    if project.deadline is not None and datetime.now(UTC) > project.deadline:
        raise HTTPException(status_code=400, detail="Termenul limită a trecut")

    now = datetime.now(UTC)
    existing = await session.scalar(
        select(ProjectSubmission).where(
            ProjectSubmission.project_id == project.id,
            ProjectSubmission.student_id == current_user.id,
        )
    )
    if existing is not None:
        existing.repo_url = data.repo_url
        existing.notes_md = data.notes_md
        existing.last_updated_at = now
        submission = existing
    else:
        submission = ProjectSubmission(
            project_id=project.id,
            student_id=current_user.id,
            repo_url=data.repo_url,
            notes_md=data.notes_md,
            submitted_at=now,
            last_updated_at=now,
        )
        session.add(submission)
    await session.commit()
    submission = await session.scalar(
        select(ProjectSubmission)
        .where(ProjectSubmission.id == submission.id)
        .options(selectinload(ProjectSubmission.grade))
    )
    assert submission is not None
    return await _submission_to_read(session, submission, with_repo_info=False)


@router.get("/{slug}/submissions", response_model=ProjectSubmissionListResponse)
async def list_submissions(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProjectSubmissionListResponse:
    """list a project's submissions, the teacher who created it or an admin"""
    project = await _get_project_or_404(slug, session)
    if not _can_edit(project, current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    submissions = (
        await session.scalars(
            select(ProjectSubmission)
            .where(ProjectSubmission.project_id == project.id)
            .options(selectinload(ProjectSubmission.grade))
            .order_by(ProjectSubmission.submitted_at.asc())
        )
    ).all()

    items = [await _submission_to_read(session, s, with_repo_info=True) for s in submissions]
    return ProjectSubmissionListResponse(items=items, total=len(items))


@router.post("/{slug}/submissions/{submission_id}/grade", response_model=ProjectSubmissionRead)
async def grade_submission(
    slug: str,
    submission_id: uuid.UUID,
    data: ProjectGradeCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProjectSubmissionRead:
    """grade a submission with a score and markdown feedback, teacher or admin only"""
    project = await _get_project_or_404(slug, session)
    if not _can_edit(project, current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    submission = await session.scalar(
        select(ProjectSubmission)
        .where(ProjectSubmission.id == submission_id, ProjectSubmission.project_id == project.id)
        .options(selectinload(ProjectSubmission.grade))
    )
    if submission is None:
        raise HTTPException(status_code=404, detail="Submisia nu a fost găsită")

    now = datetime.now(UTC)
    if submission.grade is not None:
        submission.grade.score = data.score
        submission.grade.feedback_md = data.feedback_md
        submission.grade.grader_id = current_user.id
        submission.grade.graded_at = now
    else:
        # Assign via the relationship (not a bare session.add with a raw FK) so the
        # already-loaded `submission.grade` attribute reflects the new grade in
        # memory immediately, without needing to re-fetch from the DB.
        submission.grade = ProjectGrade(
            grader_id=current_user.id,
            score=data.score,
            feedback_md=data.feedback_md,
            graded_at=now,
        )
    await session.commit()

    return await _submission_to_read(session, submission, with_repo_info=False)
