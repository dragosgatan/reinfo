"""Problem management endpoints."""

import math
import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from sqlalchemy import String, and_, case, cast, exists, func, or_, select
from sqlalchemy import delete as sa_delete
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import array as pg_array
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.dependencies import get_current_user, get_optional_user
from app.models.contest import Contest
from app.models.problem import Problem, TestCase, Visibility
from app.models.submission import Submission, Verdict
from app.models.user import User, UserRole
from app.schemas.problem import (
    OriginContest,
    ProblemCreate,
    ProblemDetail,
    ProblemListItem,
    ProblemListResponse,
    ProblemRead,
    ProblemUpdate,
    TestCaseRead,
    TestCaseSummary,
    UserProblemStatus,
)
from app.storage import delete_test_case, read_test_case, save_test_case

router = APIRouter(prefix="/api/problems", tags=["problems"])

_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


def _solve_subquery():
    """Subquery: problem_id → distinct AC-submission user count."""
    return (
        select(
            Submission.problem_id,
            func.count(Submission.user_id.distinct()).label("solve_count"),
        )
        .where(Submission.verdict == Verdict.AC)
        .group_by(Submission.problem_id)
        .subquery()
    )


def _user_status_subquery(user_id: uuid.UUID):
    """Subquery: problem_id → 'solved'|'attempted'|'unsolved' for a given user."""
    return (
        select(
            Submission.problem_id,
            case(
                (func.count(Submission.id).filter(Submission.verdict == Verdict.AC) > 0, "solved"),
                (func.count(Submission.id) > 0, "attempted"),
                else_="unsolved",
            ).label("user_status"),
        )
        .where(Submission.user_id == user_id)
        .group_by(Submission.problem_id)
        .subquery()
    )


async def _get_problem_or_404(slug: str, session: AsyncSession) -> Problem:
    problem = await session.scalar(select(Problem).where(Problem.slug == slug))
    if problem is None:
        raise HTTPException(status_code=404, detail="Problema nu a fost găsită")
    return problem


def _assert_can_view(
    problem: Problem,
    user: User | None,
    *,
    contest_ended: bool = False,
    is_contest_participant: bool = False,
) -> None:
    """Raise 403 if user cannot see a non-public problem."""
    if problem.visibility == Visibility.public:
        return
    if problem.visibility == Visibility.contest and (contest_ended or is_contest_participant):
        return
    if user is None:
        raise HTTPException(status_code=403, detail="Acces interzis")
    if user.role == UserRole.admin or problem.author_id == user.id:
        return
    raise HTTPException(status_code=403, detail="Acces interzis")


def _assert_can_edit(problem: Problem, user: User) -> None:
    """Raise 403 if user is neither the author nor an admin."""
    if user.role == UserRole.admin or problem.author_id == user.id:
        return
    raise HTTPException(status_code=403, detail="Permisiuni insuficiente")


@router.get("", response_model=ProblemListResponse)
async def list_problems(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    search: str | None = Query(None),
    tags: list[str] = Query(default=[]),
    difficulty_min: int | None = Query(None, ge=1, le=10),
    difficulty_max: int | None = Query(None, ge=1, le=10),
    status: Literal["solved", "attempted", "unsolved"] | None = Query(None),
    sort: Literal["newest", "oldest", "easiest", "hardest", "most_solved"] = Query("oldest"),
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> ProblemListResponse:
    """Lista problemelor cu paginare, filtrare și sortare."""
    if status is not None and current_user is None:
        raise HTTPException(
            status_code=401, detail="Autentificare necesară pentru filtrarea după status"
        )

    solve_sq = _solve_subquery()
    user_sq = _user_status_subquery(current_user.id) if current_user else None

    select_cols: list = [
        Problem,
        func.coalesce(solve_sq.c.solve_count, 0).label("solve_count"),
    ]
    if user_sq is not None:
        select_cols.append(func.coalesce(user_sq.c.user_status, "unsolved").label("user_status"))

    stmt = select(*select_cols).outerjoin(solve_sq, Problem.id == solve_sq.c.problem_id)
    if user_sq is not None:
        stmt = stmt.outerjoin(user_sq, Problem.id == user_sq.c.problem_id)

    _ended_contest = exists(
        select(Contest.id).where(
            Contest.id == Problem.origin_contest_id,
            Contest.end_time < func.now(),
        )
    )

    if current_user is None:
        stmt = stmt.where(
            or_(
                Problem.visibility == Visibility.public,
                and_(Problem.visibility == Visibility.contest, _ended_contest),
            )
        )
    elif current_user.role == UserRole.admin:
        stmt = stmt.where(Problem.visibility != Visibility.private)
    else:
        stmt = stmt.where(
            or_(
                Problem.visibility == Visibility.public,
                Problem.author_id == current_user.id,
                and_(Problem.visibility == Visibility.contest, _ended_contest),
            )
        )

    # optional filters
    if search:
        stmt = stmt.where(Problem.title.ilike(f"%{search}%"))
    if tags:
        stmt = stmt.where(Problem.tags.op("@>")(cast(pg_array(tags), ARRAY(String))))
    if difficulty_min is not None:
        stmt = stmt.where(Problem.difficulty >= difficulty_min)
    if difficulty_max is not None:
        stmt = stmt.where(Problem.difficulty <= difficulty_max)
    if status is not None and user_sq is not None:
        stmt = stmt.where(func.coalesce(user_sq.c.user_status, "unsolved") == status)

    # count before pagination
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0

    # sort
    if sort == "newest":
        stmt = stmt.order_by(Problem.created_at.desc())
    elif sort == "oldest":
        stmt = stmt.order_by(Problem.created_at.asc())
    elif sort == "easiest":
        stmt = stmt.order_by(Problem.difficulty.asc(), Problem.created_at.desc())
    elif sort == "hardest":
        stmt = stmt.order_by(Problem.difficulty.desc(), Problem.created_at.desc())
    else:  # most_solved
        stmt = stmt.order_by(
            func.coalesce(solve_sq.c.solve_count, 0).desc(), Problem.created_at.desc()
        )

    stmt = stmt.offset((page - 1) * per_page).limit(per_page)
    rows = (await session.execute(stmt)).all()

    items = []
    for row in rows:
        problem = row[0]
        solve_count = row[1]
        raw_status = row[2] if (current_user and len(row) > 2) else None
        items.append(
            ProblemListItem(
                id=problem.id,
                slug=problem.slug,
                title=problem.title,
                difficulty=problem.difficulty,
                tags=problem.tags,
                solve_count=solve_count,
                user_status=UserProblemStatus(raw_status) if raw_status else None,
            )
        )

    pages = math.ceil(total / per_page) if total > 0 else 0
    return ProblemListResponse(items=items, total=total, page=page, per_page=per_page, pages=pages)


@router.get("/{slug}", response_model=ProblemDetail)
async def get_problem(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> ProblemDetail:
    """Detalii complete ale problemei, inclusiv cazurile de test eșantion."""
    problem = await session.scalar(
        select(Problem).where(Problem.slug == slug).options(selectinload(Problem.test_cases))
    )
    if problem is None:
        raise HTTPException(status_code=404, detail="Problema nu a fost găsită")

    contest_ended = False
    is_contest_participant = False
    origin: Contest | None = None
    if problem.origin_contest_id:
        origin = await session.get(Contest, problem.origin_contest_id)
        if origin is not None:
            now_ts = datetime.now(UTC)
            if origin.end_time < now_ts:
                contest_ended = True
            elif current_user is not None and origin.start_time <= now_ts:
                from app.models.classroom import Class, ClassMember
                from app.models.contest import ContestParticipant

                participant = await session.scalar(
                    select(ContestParticipant).where(
                        ContestParticipant.contest_id == origin.id,
                        ContestParticipant.user_id == current_user.id,
                    )
                )
                if participant:
                    is_contest_participant = True
                elif origin.class_id:
                    cls = await session.get(Class, origin.class_id)
                    if cls is not None:
                        if cls.teacher_id == current_user.id:
                            is_contest_participant = True
                        else:
                            member = await session.scalar(
                                select(ClassMember).where(
                                    ClassMember.class_id == origin.class_id,
                                    ClassMember.user_id == current_user.id,
                                )
                            )
                            is_contest_participant = member is not None

    _assert_can_view(
        problem,
        current_user,
        contest_ended=contest_ended,
        is_contest_participant=is_contest_participant,
    )

    solve_count = (
        await session.scalar(
            select(func.count(Submission.user_id.distinct())).where(
                Submission.problem_id == problem.id, Submission.verdict == Verdict.AC
            )
        )
        or 0
    )

    sample_tcs = [TestCaseSummary.model_validate(tc) for tc in problem.test_cases if tc.is_sample]

    pr = ProblemRead.model_validate(problem)
    return ProblemDetail(
        **pr.model_dump(),
        solve_count=solve_count,
        sample_test_cases=sample_tcs,
        origin_contest=OriginContest(slug=origin.slug, title=origin.title) if origin else None,
    )


@router.post("", response_model=ProblemRead, status_code=201)
async def create_problem(
    data: ProblemCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProblemRead:
    """Crează o problemă nouă. Necesită rolul de profesor sau administrator."""
    if current_user.role not in (UserRole.teacher, UserRole.admin):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    existing = await session.scalar(select(Problem).where(Problem.slug == data.slug))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Există deja o problemă cu acest slug")

    problem = Problem(
        **data.model_dump(),
        author_id=current_user.id,
        updated_at=datetime.now(UTC),
    )
    session.add(problem)
    await session.commit()
    await session.refresh(problem)
    return ProblemRead.model_validate(problem)


@router.patch("/{slug}", response_model=ProblemRead)
async def update_problem(
    slug: str,
    data: ProblemUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProblemRead:
    """Editează o problemă. Doar autorul sau administratorul."""
    problem = await _get_problem_or_404(slug, session)
    _assert_can_edit(problem, current_user)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(problem, field, value)
    problem.updated_at = datetime.now(UTC)

    await session.commit()
    await session.refresh(problem)
    return ProblemRead.model_validate(problem)


@router.delete("/{slug}", status_code=200)
async def delete_problem(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Ascunde problema (soft-delete: visibility → private). Doar administratorul."""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    problem = await _get_problem_or_404(slug, session)
    problem.visibility = Visibility.private
    problem.updated_at = datetime.now(UTC)

    await session.commit()
    return {"message": "Problema a fost ascunsă"}


@router.get("/{slug}/test-cases", response_model=list[TestCaseRead])
async def list_test_cases(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[TestCaseRead]:
    """Lista cazurilor de test ale problemei. Autorul sau administratorul."""
    problem = await _get_problem_or_404(slug, session)
    _assert_can_edit(problem, current_user)
    tcs = (
        await session.scalars(
            select(TestCase).where(TestCase.problem_id == problem.id).order_by(TestCase.ordinal)
        )
    ).all()
    return [TestCaseRead.model_validate(tc) for tc in tcs]


@router.delete("/{slug}/test-cases/{ordinal}", status_code=200)
async def delete_test_case_endpoint(
    slug: str,
    ordinal: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Șterge un caz de test (fișiere + rândul din DB). Autorul sau administratorul."""
    problem = await _get_problem_or_404(slug, session)
    _assert_can_edit(problem, current_user)
    tc = await session.scalar(
        select(TestCase).where(
            TestCase.problem_id == problem.id,
            TestCase.ordinal == ordinal,
        )
    )
    if tc is None:
        raise HTTPException(status_code=404, detail="Cazul de test nu a fost găsit")
    await delete_test_case(tc.input_path, tc.output_path)
    await session.execute(sa_delete(TestCase).where(TestCase.id == tc.id))
    await session.commit()
    return {"message": "Cazul de test a fost șters"}


@router.post("/{slug}/test-cases", response_model=TestCaseRead, status_code=201)
async def upload_test_case(
    slug: str,
    ordinal: int = Form(..., ge=0),
    score: int = Form(10, ge=0),
    is_sample: bool = Form(False),
    is_hidden: bool = Form(True),
    input_file: UploadFile = File(...),
    output_file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TestCaseRead:
    """Încarcă un caz de test (.in + .out). Autorul sau administratorul."""
    problem = await _get_problem_or_404(slug, session)
    _assert_can_edit(problem, current_user)

    input_bytes = await input_file.read()
    output_bytes = await output_file.read()

    if len(input_bytes) > _MAX_UPLOAD_BYTES or len(output_bytes) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Fișier prea mare (max 10 MB)")

    in_path, out_path = await save_test_case(problem.id, ordinal, input_bytes, output_bytes)

    # upsert: update if same ordinal already exists for this problem
    existing = await session.scalar(
        select(TestCase).where(
            TestCase.problem_id == problem.id,
            TestCase.ordinal == ordinal,
        )
    )
    if existing is not None:
        existing.input_path = in_path
        existing.output_path = out_path
        existing.score = score
        existing.is_sample = is_sample
        existing.is_hidden = is_hidden
        tc = existing
    else:
        tc = TestCase(
            problem_id=problem.id,
            ordinal=ordinal,
            input_path=in_path,
            output_path=out_path,
            score=score,
            is_sample=is_sample,
            is_hidden=is_hidden,
        )
        session.add(tc)

    await session.commit()
    await session.refresh(tc)
    return TestCaseRead.model_validate(tc)


@router.get("/{slug}/input/{ordinal}")
async def download_input(
    slug: str,
    ordinal: int,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> Response:
    """Descarcă fișierul .in. Cazurile non-eșantion sunt restricționate la autor/admin."""
    problem = await _get_problem_or_404(slug, session)
    _assert_can_view(problem, current_user)

    tc = await session.scalar(
        select(TestCase).where(
            TestCase.problem_id == problem.id,
            TestCase.ordinal == ordinal,
        )
    )
    if tc is None:
        raise HTTPException(status_code=404, detail="Cazul de test nu a fost găsit")

    is_author_or_admin = current_user is not None and (
        current_user.role == UserRole.admin or current_user.id == problem.author_id
    )
    if not tc.is_sample and not is_author_or_admin:
        raise HTTPException(status_code=403, detail="Acces interzis la cazuri de test non-eșantion")

    try:
        content = await read_test_case(tc.input_path)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404, detail="Fișierul de intrare nu a fost găsit pe disc"
        ) from None

    return Response(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{ordinal}.in"'},
    )
