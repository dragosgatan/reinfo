"""Submission creation and query endpoints."""

import asyncio
import json
import math
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, date, datetime, time

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.dependencies import get_current_user, get_optional_user
from app.models.judging_job import JobStatus, JudgingJob
from app.models.problem import Problem, Visibility
from app.models.submission import Submission, Verdict
from app.models.user import User, UserRole
from app.schemas.submission import (
    SubmissionListResponse,
    SubmissionRead,
    SubmissionSummary,
)
from app.storage import save_submission_code, save_submission_output

router = APIRouter(tags=["submissions"])

_MAX_OUTPUT_BYTES = 10 * 1024 * 1024  # 10 MB
_MAX_CODE_BYTES = 512 * 1024  # 512 KB


def _can_view_submission(sub: Submission, user: User | None, problem: Problem) -> bool:
    if user is None:
        return False
    if user.id == sub.user_id:
        return True
    if user.role == UserRole.admin:
        return True
    return problem.author_id is not None and problem.author_id == user.id


@router.post("/api/problems/{slug}/submit", response_model=SubmissionRead, status_code=201)
async def submit(
    slug: str,
    output_file: UploadFile = File(...),
    source_code: UploadFile | None = File(default=None),
    language: str | None = Form(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SubmissionRead:
    """Trimite output-ul pentru o problemă. Judecarea este asincronă (job queue)."""
    problem = await session.scalar(select(Problem).where(Problem.slug == slug))
    if problem is None:
        raise HTTPException(status_code=404, detail="Problema nu a fost găsită")

    if (
        problem.visibility != Visibility.public
        and current_user.role != UserRole.admin
        and problem.author_id != current_user.id
    ):
        raise HTTPException(status_code=403, detail="Acces interzis")

    output_bytes = await output_file.read()
    if len(output_bytes) > _MAX_OUTPUT_BYTES:
        raise HTTPException(status_code=413, detail="Fișierul output este prea mare (max 10 MB)")

    submission_id = uuid.uuid4()
    output_path = await save_submission_output(current_user.id, submission_id, output_bytes)

    code_path: str | None = None
    if source_code is not None:
        code_bytes = await source_code.read()
        if len(code_bytes) > _MAX_CODE_BYTES:
            raise HTTPException(status_code=413, detail="Codul sursă este prea mare (max 512 KB)")
        code_path = await save_submission_code(
            current_user.id, submission_id, language or "txt", code_bytes
        )

    submission = Submission(
        id=submission_id,
        user_id=current_user.id,
        problem_id=problem.id,
        submitted_output_path=output_path,
        submitted_code_path=code_path,
        language=language,
        verdict=Verdict.pending,
        score=0,
    )
    session.add(submission)
    session.add(JudgingJob(submission_id=submission_id))
    await session.commit()

    sub = await session.scalar(
        select(Submission)
        .where(Submission.id == submission_id)
        .options(selectinload(Submission.results))
    )
    return SubmissionRead.model_validate(sub)


@router.get("/api/submissions/{submission_id}/stream")
async def stream_submission_events(
    submission_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> StreamingResponse:
    """SSE stream of judging progress for a submission.

    Emits a JSON event every ~500 ms until the job reaches a terminal state.
    Each event: data: {"submission_id", "verdict", "score", "job_status"}
    """
    sub = await session.scalar(
        select(Submission)
        .where(Submission.id == submission_id)
        .options(selectinload(Submission.problem))
    )
    if sub is None:
        raise HTTPException(status_code=404, detail="Submisia nu a fost găsită")
    if not _can_view_submission(sub, current_user, sub.problem):
        raise HTTPException(status_code=403, detail="Acces interzis")

    _TERMINAL = {JobStatus.done, JobStatus.failed}

    async def event_generator() -> AsyncGenerator[str, None]:
        while True:
            current_sub = await session.scalar(
                select(Submission).where(Submission.id == submission_id)
            )
            job = await session.scalar(
                select(JudgingJob).where(JudgingJob.submission_id == submission_id)
            )
            await session.commit()

            payload = json.dumps(
                {
                    "submission_id": str(submission_id),
                    "verdict": current_sub.verdict.value if current_sub else None,
                    "score": current_sub.score if current_sub else 0,
                    "job_status": job.status.value if job else None,
                }
            )
            yield f"data: {payload}\n\n"

            if job is None or job.status in _TERMINAL:
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/api/submissions/{submission_id}", response_model=SubmissionRead)
async def get_submission(
    submission_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> SubmissionRead:
    """Detalii complete ale unei submisii. Vizibil pentru proprietar, autorul problemei și admin."""
    sub = await session.scalar(
        select(Submission)
        .where(Submission.id == submission_id)
        .options(selectinload(Submission.results), selectinload(Submission.problem))
    )
    if sub is None:
        raise HTTPException(status_code=404, detail="Submisia nu a fost găsită")

    if not _can_view_submission(sub, current_user, sub.problem):
        raise HTTPException(status_code=403, detail="Acces interzis")

    return SubmissionRead.model_validate(sub)


@router.get("/api/submissions", response_model=SubmissionListResponse)
async def list_submissions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    user_id: uuid.UUID | None = Query(default=None),
    problem_slug: str | None = Query(default=None),
    verdict: Verdict | None = Query(default=None),
    contest_id: uuid.UUID | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SubmissionListResponse:
    """Lista paginată a submisiilor. Utilizatorii văd doar ale proprii; adminii pot filtra după orice user_id."""
    filters = []

    if current_user.role != UserRole.admin:
        filters.append(Submission.user_id == current_user.id)
        if user_id is not None and user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Permisiuni insuficiente")
    elif user_id is not None:
        filters.append(Submission.user_id == user_id)

    if verdict is not None:
        filters.append(Submission.verdict == verdict)
    if contest_id is not None:
        filters.append(Submission.contest_id == contest_id)
    if date_from is not None:
        filters.append(Submission.created_at >= datetime.combine(date_from, time.min, tzinfo=UTC))
    if date_to is not None:
        filters.append(Submission.created_at <= datetime.combine(date_to, time.max, tzinfo=UTC))
    if problem_slug is not None:
        filters.append(Problem.slug == problem_slug)

    base = select(Submission).join(Problem, Submission.problem_id == Problem.id).where(*filters)

    total = await session.scalar(select(func.count()).select_from(base.subquery())) or 0

    rows = (
        await session.execute(
            select(Submission, Problem.slug.label("problem_slug"))
            .join(Problem, Submission.problem_id == Problem.id)
            .where(*filters)
            .order_by(Submission.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
    ).all()

    items = [
        SubmissionSummary(
            id=row.Submission.id,
            user_id=row.Submission.user_id,
            problem_id=row.Submission.problem_id,
            problem_slug=row.problem_slug,
            contest_id=row.Submission.contest_id,
            verdict=row.Submission.verdict,
            score=row.Submission.score,
            language=row.Submission.language,
            created_at=row.Submission.created_at,
            judged_at=row.Submission.judged_at,
        )
        for row in rows
    ]

    pages = math.ceil(total / per_page) if total > 0 else 0
    return SubmissionListResponse(
        items=items, total=total, page=page, per_page=per_page, pages=pages
    )


@router.get("/api/users/{username}/submissions", response_model=SubmissionListResponse)
async def get_user_submissions(
    username: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
) -> SubmissionListResponse:
    """Istoricul public al submisiilor unui utilizator."""
    target = await session.scalar(select(User).where(User.username == username))
    if target is None:
        raise HTTPException(status_code=404, detail="Utilizatorul nu a fost găsit")

    total = (
        await session.scalar(
            select(func.count(Submission.id)).where(Submission.user_id == target.id)
        )
        or 0
    )

    rows = (
        await session.execute(
            select(Submission, Problem.slug.label("problem_slug"))
            .join(Problem, Submission.problem_id == Problem.id)
            .where(Submission.user_id == target.id)
            .order_by(Submission.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
    ).all()

    items = [
        SubmissionSummary(
            id=row.Submission.id,
            user_id=row.Submission.user_id,
            problem_id=row.Submission.problem_id,
            problem_slug=row.problem_slug,
            contest_id=row.Submission.contest_id,
            verdict=row.Submission.verdict,
            score=row.Submission.score,
            language=row.Submission.language,
            created_at=row.Submission.created_at,
            judged_at=row.Submission.judged_at,
        )
        for row in rows
    ]

    pages = math.ceil(total / per_page) if total > 0 else 0
    return SubmissionListResponse(
        items=items, total=total, page=page, per_page=per_page, pages=pages
    )
