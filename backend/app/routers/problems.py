"""problem management endpoints"""

import math
import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from sqlalchemy import String, and_, case, cast, exists, func, or_, select
from sqlalchemy import delete as sa_delete
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import array as pg_array
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import piston as piston_client
from app.db import get_session
from app.dependencies import get_current_user, get_optional_user
from app.judging import _compare_exact, _compare_float_epsilon, _compare_whitespace_insensitive
from app.limiter import limiter
from app.models.contest import Contest
from app.models.problem import (
    ComparisonMode,
    DatasetMetric,
    Problem,
    ProblemType,
    QuizOption,
    TestCase,
    Visibility,
)
from app.models.submission import Submission, Verdict
from app.models.user import User, UserRole
from app.piston import SUPPORTED_LANGUAGES
from app.schemas.problem import (
    DatasetFilesStatus,
    OriginContest,
    ProblemCreate,
    ProblemDetail,
    ProblemListItem,
    ProblemListResponse,
    ProblemRead,
    ProblemUpdate,
    QuizAttemptRequest,
    QuizAttemptResult,
    QuizOptionCreate,
    QuizOptionRead,
    QuizOptionWithAnswer,
    RunCustomResult,
    RunRequest,
    RunResponse,
    RunSampleResult,
    TestCaseRead,
    TestCaseSummary,
    UserProblemStatus,
)
from app.storage import (
    dataset_file_exists,
    delete_test_case,
    read_dataset_file,
    read_test_case,
    save_dataset_file,
    save_test_case,
)

router = APIRouter(prefix="/api/problems", tags=["problems"])

_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
_MAX_CODE_BYTES = 512 * 1024  # 512 KB


def _solve_subquery():
    """subquery: problem_id → distinct ac-submission user count"""
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
    """subquery: problem_id → 'solved'|'attempted'|'unsolved' for a given user"""
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
    """raise 403 if user cannot see a non-public problem"""
    if problem.visibility == Visibility.public:
        return
    if problem.visibility == Visibility.contest and (contest_ended or is_contest_participant):
        return
    if user is None:
        raise HTTPException(status_code=403, detail="Acces interzis")
    if user.role in (UserRole.admin, UserRole.superuser) or problem.author_id == user.id:
        return
    raise HTTPException(status_code=403, detail="Acces interzis")


def _assert_can_edit(problem: Problem, user: User) -> None:
    """raise 403 if user is neither the author nor an admin"""
    if user.role in (UserRole.admin, UserRole.superuser) or problem.author_id == user.id:
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
    problem_type: Literal["standard", "quiz", "dataset"] | None = Query(None),
    dataset_metric: Literal["accuracy", "f1", "rmse", "mae"] | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> ProblemListResponse:
    """list problems with pagination, filtering, and sorting"""
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
    elif current_user.role in (UserRole.admin, UserRole.superuser):
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
    if problem_type is not None:
        stmt = stmt.where(Problem.problem_type == ProblemType(problem_type))
    if dataset_metric is not None:
        stmt = stmt.where(Problem.dataset_metric == DatasetMetric(dataset_metric))

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
                problem_type=problem.problem_type,
                dataset_metric=problem.dataset_metric,
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
    """full problem details, including sample test cases"""
    problem = await session.scalar(
        select(Problem)
        .where(Problem.slug == slug)
        .options(selectinload(Problem.test_cases), selectinload(Problem.quiz_options))
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
    quiz_opts = [QuizOptionRead.model_validate(o) for o in problem.quiz_options]

    dataset_files: list[str] = []
    if problem.problem_type == ProblemType.dataset:
        dataset_files = [
            name
            for name in ("train.csv", "test.csv", "sample_submission.csv")
            if dataset_file_exists(problem.slug, name)
        ]

    pr = ProblemRead.model_validate(problem)
    return ProblemDetail(
        **pr.model_dump(),
        solve_count=solve_count,
        sample_test_cases=sample_tcs,
        quiz_options=quiz_opts,
        origin_contest=OriginContest(slug=origin.slug, title=origin.title) if origin else None,
        dataset_files=dataset_files,
    )


@router.post("", response_model=ProblemRead, status_code=201)
async def create_problem(
    data: ProblemCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProblemRead:
    """create a new problem, requires the teacher or admin role"""
    if current_user.role not in (UserRole.teacher, UserRole.admin, UserRole.superuser):
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
    """edit a problem, author or admin only"""
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
    """hide the problem (soft-delete: visibility → private), admin only"""
    if current_user.role not in (UserRole.admin, UserRole.superuser):
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
    """list the problem's test cases, author or admin only"""
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
    """delete a test case (files + db row), author or admin only"""
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
    await _sync_score_total(problem, session)
    await session.commit()
    return {"message": "Cazul de test a fost șters"}


async def _sync_score_total(problem: Problem, session: AsyncSession) -> None:
    """update problem.score_total to match the sum of its test case scores"""
    result = await session.scalar(
        select(func.coalesce(func.sum(TestCase.score), 0)).where(TestCase.problem_id == problem.id)
    )
    problem.score_total = int(result)


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
    """upload a test case (.in + .out), author or admin only"""
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

    await _sync_score_total(problem, session)
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
    """download the .in file; non-sample cases are restricted to author/admin"""
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
        current_user.role in (UserRole.admin, UserRole.superuser)
        or current_user.id == problem.author_id
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


@router.post("/{slug}/run", response_model=RunResponse)
@limiter.limit("15/minute")
async def run_code(
    request: Request,
    slug: str,
    data: RunRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> RunResponse:
    """run code against sample cases (or a custom stdin), without creating a submission"""
    if data.language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=422,
            detail=f"Limbaj nesuportat: {data.language}. Limbaje acceptate: {sorted(SUPPORTED_LANGUAGES)}",
        )
    if len(data.source_code.encode("utf-8")) > _MAX_CODE_BYTES:
        raise HTTPException(status_code=413, detail="Codul sursă este prea mare (max 512 KB)")

    problem = await session.scalar(
        select(Problem).where(Problem.slug == slug).options(selectinload(Problem.test_cases))
    )
    if problem is None:
        raise HTTPException(status_code=404, detail="Problema nu a fost găsită")
    _assert_can_view(problem, current_user)

    if data.stdin is not None:
        exec_result = await piston_client.execute(
            language=data.language,
            code=data.source_code,
            stdin=data.stdin,
            time_limit_ms=problem.time_limit_ms,
            memory_limit_kb=problem.memory_limit_kb,
        )
        return RunResponse(
            mode="custom",
            compile_error=exec_result.compile_error,
            custom=RunCustomResult(
                stdout=exec_result.stdout,
                stderr=exec_result.stderr,
                time_ms=exec_result.time_ms,
                memory_kb=exec_result.memory_kb,
                timed_out=exec_result.timed_out,
                compile_error=exec_result.compile_error,
            ),
        )

    samples = [tc for tc in problem.test_cases if tc.is_sample]
    results: list[RunSampleResult] = []
    got_compile_error = False

    for tc in samples:
        if got_compile_error:
            break

        try:
            stdin_bytes = await read_test_case(tc.input_path)
            expected_bytes = await read_test_case(tc.output_path)
        except FileNotFoundError:
            continue

        exec_result = await piston_client.execute(
            language=data.language,
            code=data.source_code,
            stdin=stdin_bytes.decode("utf-8", errors="replace"),
            time_limit_ms=problem.time_limit_ms,
            memory_limit_kb=problem.memory_limit_kb,
        )

        if exec_result.compile_error:
            got_compile_error = True

        passed = False
        if (
            not exec_result.compile_error
            and not exec_result.timed_out
            and exec_result.memory_kb <= problem.memory_limit_kb
            and exec_result.exit_code == 0
        ):
            actual_bytes = exec_result.stdout.encode("utf-8")
            if problem.comparison_mode == ComparisonMode.exact:
                passed, _ = _compare_exact(expected_bytes, actual_bytes)
            elif problem.comparison_mode == ComparisonMode.whitespace_insensitive:
                passed, _ = _compare_whitespace_insensitive(expected_bytes, actual_bytes)
            else:
                passed, _ = _compare_float_epsilon(
                    expected_bytes, actual_bytes, problem.float_epsilon or 1e-9
                )

        results.append(
            RunSampleResult(
                ordinal=tc.ordinal,
                passed=passed,
                stdout=exec_result.stdout,
                stderr=exec_result.stderr,
                expected_output=expected_bytes.decode("utf-8", errors="replace"),
                time_ms=exec_result.time_ms,
                memory_kb=exec_result.memory_kb,
                timed_out=exec_result.timed_out,
                compile_error=exec_result.compile_error,
            )
        )

    return RunResponse(mode="samples", compile_error=got_compile_error, samples=results)


_DATASET_DOWNLOADABLE_FILES = ("train.csv", "test.csv", "sample_submission.csv")


@router.get("/{slug}/dataset-files", response_model=DatasetFilesStatus)
async def get_dataset_files_status(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> DatasetFilesStatus:
    """which csv files have been uploaded for a dataset problem, author or admin only"""
    problem = await _get_problem_or_404(slug, session)
    _assert_can_edit(problem, current_user)
    if problem.problem_type != ProblemType.dataset:
        raise HTTPException(status_code=400, detail="Problema nu este de tip dataset")

    return DatasetFilesStatus(
        train_csv=dataset_file_exists(slug, "train.csv"),
        test_csv=dataset_file_exists(slug, "test.csv"),
        sample_submission_csv=dataset_file_exists(slug, "sample_submission.csv"),
        answer_csv=dataset_file_exists(slug, "answer.csv"),
    )


@router.post("/{slug}/dataset-files", response_model=DatasetFilesStatus, status_code=201)
async def upload_dataset_files(
    slug: str,
    train_csv: UploadFile | None = File(None),
    test_csv: UploadFile | None = File(None),
    sample_submission_csv: UploadFile | None = File(None),
    answer_csv: UploadFile | None = File(None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> DatasetFilesStatus:
    """upload (or replace) a dataset problem's csv files, author or admin only; answer.csv is never exposed for download"""
    problem = await _get_problem_or_404(slug, session)
    _assert_can_edit(problem, current_user)
    if problem.problem_type != ProblemType.dataset:
        raise HTTPException(status_code=400, detail="Problema nu este de tip dataset")

    uploads = {
        "train.csv": train_csv,
        "test.csv": test_csv,
        "sample_submission.csv": sample_submission_csv,
        "answer.csv": answer_csv,
    }
    for filename, upload in uploads.items():
        if upload is None:
            continue
        data = await upload.read()
        if len(data) > _MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413, detail=f"Fișierul {filename} este prea mare (max 10 MB)"
            )
        await save_dataset_file(slug, filename, data)

    return DatasetFilesStatus(
        train_csv=dataset_file_exists(slug, "train.csv"),
        test_csv=dataset_file_exists(slug, "test.csv"),
        sample_submission_csv=dataset_file_exists(slug, "sample_submission.csv"),
        answer_csv=dataset_file_exists(slug, "answer.csv"),
    )


@router.get("/{slug}/dataset/{filename}")
async def download_dataset_file(
    slug: str,
    filename: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> Response:
    """download one of the dataset problem's public files (not answer.csv)"""
    problem = await _get_problem_or_404(slug, session)
    _assert_can_view(problem, current_user)
    if problem.problem_type != ProblemType.dataset:
        raise HTTPException(status_code=400, detail="Problema nu este de tip dataset")
    if filename not in _DATASET_DOWNLOADABLE_FILES:
        raise HTTPException(status_code=404, detail="Fișierul nu a fost găsit")

    try:
        content = await read_dataset_file(slug, filename)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Fișierul nu a fost găsit") from None

    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.put("/{slug}/quiz-options", response_model=list[QuizOptionRead], status_code=200)
async def set_quiz_options(
    slug: str,
    options: list[QuizOptionCreate],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[QuizOptionRead]:
    """replace all of the problem's quiz options, author or admin only"""
    problem = await _get_problem_or_404(slug, session)
    _assert_can_edit(problem, current_user)

    if problem.problem_type != ProblemType.quiz:
        raise HTTPException(status_code=400, detail="Problema nu este de tip quiz")

    await session.execute(sa_delete(QuizOption).where(QuizOption.problem_id == problem.id))

    new_options = [
        QuizOption(
            problem_id=problem.id,
            ordinal=opt.ordinal,
            text_md=opt.text_md,
            text_md_en=opt.text_md_en,
            is_correct=opt.is_correct,
            explanation_md=opt.explanation_md,
            explanation_md_en=opt.explanation_md_en,
        )
        for opt in options
    ]
    session.add_all(new_options)
    await session.commit()

    saved = (
        await session.scalars(
            select(QuizOption)
            .where(QuizOption.problem_id == problem.id)
            .order_by(QuizOption.ordinal)
        )
    ).all()
    return [QuizOptionRead.model_validate(o) for o in saved]


@router.post("/{slug}/quiz-attempt", response_model=QuizAttemptResult)
async def quiz_attempt(
    slug: str,
    body: QuizAttemptRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> QuizAttemptResult:
    """check a quiz answer, returns correctness and explanations"""
    problem = await session.scalar(
        select(Problem).where(Problem.slug == slug).options(selectinload(Problem.quiz_options))
    )
    if problem is None:
        raise HTTPException(status_code=404, detail="Problema nu a fost găsită")
    if problem.problem_type != ProblemType.quiz:
        raise HTTPException(status_code=400, detail="Problema nu este de tip quiz")

    _assert_can_view(problem, current_user)

    correct_ids = {o.id for o in problem.quiz_options if o.is_correct}
    selected = set(body.selected_option_ids)
    is_correct = selected == correct_ids and len(correct_ids) > 0

    return QuizAttemptResult(
        correct=is_correct,
        options=[QuizOptionWithAnswer.model_validate(o) for o in problem.quiz_options],
    )
