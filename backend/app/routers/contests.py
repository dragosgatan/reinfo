"""Contest management and participation endpoints."""

import re
import time
import unicodedata
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Form, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.dependencies import get_current_user, get_optional_user, require_role
from app.models.contest import Contest, ContestParticipant, ContestProblem
from app.models.judging_job import JudgingJob
from app.models.problem import Problem, Visibility
from app.models.submission import Submission, Verdict
from app.models.user import User, UserRole
from app.piston import SUPPORTED_LANGUAGES
from app.schemas.contest import (
    ContestCreate,
    ContestDetail,
    ContestListResponse,
    ContestProblemEntry,
    ContestSummary,
    ContestUpdate,
    LeaderboardEntry,
    LeaderboardResponse,
    contest_status,
    paginate,
)
from app.schemas.submission import SubmissionRead

router = APIRouter(prefix="/api/contests", tags=["contests"])

_MAX_CODE_BYTES = 512 * 1024

# in-process leaderboard cache: contest_id → (unix_timestamp, LeaderboardResponse)
_lb_cache: dict[str, tuple[float, LeaderboardResponse]] = {}
_LB_TTL = 5.0


def _slugify(text: str) -> str:
    """Convert title to a URL-safe slug."""
    slug = unicodedata.normalize("NFKD", text)
    slug = slug.encode("ascii", "ignore").decode("ascii")
    slug = slug.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    slug = slug.strip("-")
    return slug[:128] or "concurs"


async def _get_contest_or_404(slug: str, session: AsyncSession) -> Contest:
    contest = await session.scalar(
        select(Contest)
        .where(Contest.slug == slug)
        .options(
            selectinload(Contest.contest_problems).selectinload(ContestProblem.problem),
            selectinload(Contest.participants),
        )
    )
    if contest is None:
        raise HTTPException(status_code=404, detail="Concursul nu a fost găsit")
    return contest


def _build_summary(contest: Contest, now: datetime) -> ContestSummary:
    return ContestSummary(
        id=contest.id,
        slug=contest.slug,
        title=contest.title,
        start_time=contest.start_time,
        end_time=contest.end_time,
        scoring_mode=contest.scoring_mode,
        participant_count=len(contest.participants),
        problem_count=len(contest.contest_problems),
        status=contest_status(now, contest.start_time, contest.end_time),
    )


def _build_detail(
    contest: Contest,
    now: datetime,
    current_user: User | None,
    is_registered: bool,
) -> ContestDetail:
    status = contest_status(now, contest.start_time, contest.end_time)
    is_staff = current_user is not None and current_user.role in (UserRole.teacher, UserRole.admin)
    show_problems = status != "upcoming" or is_staff

    problems: list[ContestProblemEntry] = []
    if show_problems:
        for cp in contest.contest_problems:
            problems.append(
                ContestProblemEntry(
                    ordinal=cp.ordinal,
                    problem_slug=cp.problem.slug,
                    problem_title=cp.problem.title,
                    score_total=cp.problem.score_total,
                    solved_by_user=None,
                )
            )

    return ContestDetail(
        id=contest.id,
        slug=contest.slug,
        title=contest.title,
        description_md=contest.description_md,
        start_time=contest.start_time,
        end_time=contest.end_time,
        scoring_mode=contest.scoring_mode,
        participant_count=len(contest.participants),
        problem_count=len(contest.contest_problems),
        status=status,
        created_by=contest.created_by,
        is_registered=is_registered,
        problems=problems,
    )


@router.get("/", response_model=ContestListResponse)
async def list_contests(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    status: str | None = Query(default=None, description="upcoming | ongoing | past"),
    session: AsyncSession = Depends(get_session),
) -> ContestListResponse:
    """Lista concursurilor cu paginare și filtrare după status."""
    now = datetime.now(UTC)

    stmt = (
        select(Contest)
        .options(
            selectinload(Contest.contest_problems),
            selectinload(Contest.participants),
        )
        .where(Contest.is_public.is_(True))
        .order_by(Contest.start_time.desc())
    )

    all_contests = list(await session.scalars(stmt))

    if status in ("upcoming", "ongoing", "past"):
        all_contests = [
            c for c in all_contests if contest_status(now, c.start_time, c.end_time) == status
        ]

    total = len(all_contests)
    offset = (page - 1) * per_page
    page_items = all_contests[offset : offset + per_page]

    return ContestListResponse(
        items=[_build_summary(c, now) for c in page_items],
        total=total,
        page=page,
        per_page=per_page,
        pages=paginate(total, per_page),
    )


@router.get("/{slug}", response_model=ContestDetail)
async def get_contest(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> ContestDetail:
    """Detalii concurs. Problemele sunt ascunse înainte de start pentru participanți obișnuiți."""
    contest = await _get_contest_or_404(slug, session)
    now = datetime.now(UTC)
    is_registered = current_user is not None and any(
        p.user_id == current_user.id for p in contest.participants
    )
    return _build_detail(contest, now, current_user, is_registered)


@router.post("/", response_model=ContestDetail, status_code=201)
async def create_contest(
    data: ContestCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = require_role(UserRole.teacher, UserRole.admin),
) -> ContestDetail:
    """Creează un concurs nou. Necesită rolul de profesor sau administrator."""
    base_slug = _slugify(data.title)
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
        created_by=current_user.id,
    )
    session.add(contest)
    await session.commit()

    contest = await _get_contest_or_404(slug, session)
    now = datetime.now(UTC)
    return _build_detail(contest, now, current_user, False)


@router.patch("/{slug}", response_model=ContestDetail)
async def update_contest(
    slug: str,
    data: ContestUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = require_role(UserRole.teacher, UserRole.admin),
) -> ContestDetail:
    """Editează un concurs. Doar creatorul sau administratorul."""
    contest = await _get_contest_or_404(slug, session)

    if current_user.role != UserRole.admin and contest.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(contest, field, value)

    await session.commit()
    contest = await _get_contest_or_404(slug, session)
    now = datetime.now(UTC)
    is_registered = any(p.user_id == current_user.id for p in contest.participants)
    return _build_detail(contest, now, current_user, is_registered)


@router.delete("/{slug}", status_code=200)
async def delete_contest(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = require_role(UserRole.teacher, UserRole.admin),
) -> dict[str, str]:
    """Șterge un concurs. Doar creatorul sau administratorul."""
    contest = await session.scalar(select(Contest).where(Contest.slug == slug))
    if contest is None:
        raise HTTPException(status_code=404, detail="Concursul nu a fost găsit")

    if current_user.role != UserRole.admin and contest.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    await session.delete(contest)
    await session.commit()
    return {"message": "Concursul a fost șters"}


@router.post("/{slug}/register", status_code=201)
async def register_for_contest(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Înregistrează utilizatorul curent la concurs."""
    contest = await session.scalar(select(Contest).where(Contest.slug == slug))
    if contest is None:
        raise HTTPException(status_code=404, detail="Concursul nu a fost găsit")

    now = datetime.now(UTC)
    status = contest_status(now, contest.start_time, contest.end_time)
    if status == "past":
        raise HTTPException(status_code=400, detail="Concursul s-a terminat")

    existing = await session.scalar(
        select(ContestParticipant).where(
            ContestParticipant.contest_id == contest.id,
            ContestParticipant.user_id == current_user.id,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Ești deja înregistrat la acest concurs")

    session.add(ContestParticipant(contest_id=contest.id, user_id=current_user.id))
    await session.commit()
    return {"message": "Înregistrare reușită"}


@router.post("/{slug}/problems", status_code=201)
async def add_problem_to_contest(
    slug: str,
    problem_slug: str = Query(...),
    session: AsyncSession = Depends(get_session),
    current_user: User = require_role(UserRole.teacher, UserRole.admin),
) -> dict[str, str]:
    """Adaugă o problemă la concurs și o marchează ca privată (visibility=contest)."""
    contest = await session.scalar(select(Contest).where(Contest.slug == slug))
    if contest is None:
        raise HTTPException(status_code=404, detail="Concursul nu a fost găsit")

    if current_user.role != UserRole.admin and contest.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    problem = await session.scalar(select(Problem).where(Problem.slug == problem_slug))
    if problem is None:
        raise HTTPException(status_code=404, detail="Problema nu a fost găsită")

    existing = await session.scalar(
        select(ContestProblem).where(
            ContestProblem.contest_id == contest.id,
            ContestProblem.problem_id == problem.id,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Problema este deja în concurs")

    max_ordinal = await session.scalar(
        select(func.max(ContestProblem.ordinal)).where(ContestProblem.contest_id == contest.id)
    )
    ordinal = (max_ordinal or 0) + 1

    session.add(ContestProblem(contest_id=contest.id, problem_id=problem.id, ordinal=ordinal))
    problem.visibility = Visibility.contest
    problem.origin_contest_id = contest.id
    await session.commit()
    return {"message": f"Problema adăugată la ordinalul {ordinal}"}


@router.delete("/{slug}/problems/{problem_slug}", status_code=200)
async def remove_problem_from_contest(
    slug: str,
    problem_slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = require_role(UserRole.teacher, UserRole.admin),
) -> dict[str, str]:
    """Elimină o problemă din concurs și o readuce la draft."""
    contest = await session.scalar(select(Contest).where(Contest.slug == slug))
    if contest is None:
        raise HTTPException(status_code=404, detail="Concursul nu a fost găsit")

    if current_user.role != UserRole.admin and contest.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    problem = await session.scalar(select(Problem).where(Problem.slug == problem_slug))
    if problem is None:
        raise HTTPException(status_code=404, detail="Problema nu a fost găsită")

    entry = await session.scalar(
        select(ContestProblem).where(
            ContestProblem.contest_id == contest.id,
            ContestProblem.problem_id == problem.id,
        )
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Problema nu este în concurs")

    await session.delete(entry)
    problem.visibility = Visibility.draft
    await session.commit()
    return {"message": "Problema a fost eliminată din concurs"}


@router.post(
    "/{slug}/problems/{problem_slug}/submit", response_model=SubmissionRead, status_code=201
)
async def contest_submit(
    slug: str,
    problem_slug: str,
    source_code: str = Form(...),
    language: str = Form(...),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SubmissionRead:
    """Trimite codul sursă pentru o problemă de concurs."""
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=422,
            detail=f"Limbaj nesuportat: {language}. Limbaje acceptate: {sorted(SUPPORTED_LANGUAGES)}",
        )

    if len(source_code.encode("utf-8")) > _MAX_CODE_BYTES:
        raise HTTPException(status_code=413, detail="Codul sursă este prea mare (max 512 KB)")

    contest = await session.scalar(select(Contest).where(Contest.slug == slug))
    if contest is None:
        raise HTTPException(status_code=404, detail="Concursul nu a fost găsit")

    now = datetime.now(UTC)
    status = contest_status(now, contest.start_time, contest.end_time)
    if status != "ongoing":
        raise HTTPException(status_code=400, detail="Concursul nu este activ")

    participant = await session.scalar(
        select(ContestParticipant).where(
            ContestParticipant.contest_id == contest.id,
            ContestParticipant.user_id == current_user.id,
        )
    )
    if participant is None:
        raise HTTPException(status_code=403, detail="Nu ești înregistrat la acest concurs")

    problem = await session.scalar(select(Problem).where(Problem.slug == problem_slug))
    if problem is None:
        raise HTTPException(status_code=404, detail="Problema nu a fost găsită")

    in_contest = await session.scalar(
        select(ContestProblem).where(
            ContestProblem.contest_id == contest.id,
            ContestProblem.problem_id == problem.id,
        )
    )
    if in_contest is None:
        raise HTTPException(status_code=404, detail="Problema nu face parte din acest concurs")

    submission_id = uuid.uuid4()
    submission = Submission(
        id=submission_id,
        user_id=current_user.id,
        problem_id=problem.id,
        contest_id=contest.id,
        submitted_code=source_code,
        language=language,
        verdict=Verdict.pending,
        score=0,
    )
    session.add(submission)
    session.add(JudgingJob(submission_id=submission_id))
    await session.commit()

    from sqlalchemy.orm import selectinload

    sub = await session.scalar(
        select(Submission)
        .where(Submission.id == submission_id)
        .options(selectinload(Submission.results))
    )
    return SubmissionRead.model_validate(sub)


@router.get("/{slug}/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    slug: str,
    session: AsyncSession = Depends(get_session),
) -> LeaderboardResponse:
    """Clasamentul concursului (cache 5 secunde)."""
    now_ts = time.monotonic()
    cached = _lb_cache.get(slug)
    if cached and (now_ts - cached[0]) < _LB_TTL:
        return cached[1]

    contest = await session.scalar(
        select(Contest)
        .where(Contest.slug == slug)
        .options(
            selectinload(Contest.contest_problems).selectinload(ContestProblem.problem),
            selectinload(Contest.participants).selectinload(ContestParticipant.user),
        )
    )
    if contest is None:
        raise HTTPException(status_code=404, detail="Concursul nu a fost găsit")

    problem_slugs = [cp.problem.slug for cp in contest.contest_problems]
    problem_id_to_slug = {cp.problem_id: cp.problem.slug for cp in contest.contest_problems}
    participant_ids = [p.user_id for p in contest.participants]

    if not participant_ids or not problem_slugs:
        response = LeaderboardResponse(
            contest_slug=slug,
            entries=[],
            generated_at=datetime.now(UTC),
        )
        _lb_cache[slug] = (now_ts, response)
        return response

    rows = (
        await session.execute(
            select(
                Submission.user_id,
                Submission.problem_id,
                func.max(Submission.score).label("best_score"),
                func.max(Submission.created_at).label("last_at"),
            )
            .where(
                Submission.contest_id == contest.id,
                Submission.user_id.in_(participant_ids),
                Submission.problem_id.in_(list(problem_id_to_slug.keys())),
            )
            .group_by(Submission.user_id, Submission.problem_id)
        )
    ).all()

    participant_map = {p.user_id: p.user for p in contest.participants}

    scores: dict[uuid.UUID, dict[str, int]] = {uid: {} for uid in participant_ids}
    last_sub: dict[uuid.UUID, datetime | None] = {uid: None for uid in participant_ids}

    for row in rows:
        uid = row.user_id
        pslug = problem_id_to_slug.get(row.problem_id)
        if pslug and uid in scores:
            scores[uid][pslug] = row.best_score
            if last_sub[uid] is None or row.last_at > last_sub[uid]:
                last_sub[uid] = row.last_at

    entries = []
    for uid in participant_ids:
        user = participant_map.get(uid)
        if user is None:
            continue
        total = sum(scores[uid].values())
        problem_scores = {ps: scores[uid].get(ps, 0) for ps in problem_slugs}
        entries.append(
            LeaderboardEntry(
                rank=0,
                user_id=uid,
                username=user.username,
                display_name=user.display_name,
                total_score=total,
                problem_scores=problem_scores,
                last_submission_at=last_sub[uid],
            )
        )

    entries.sort(
        key=lambda e: (-e.total_score, e.last_submission_at or datetime.max.replace(tzinfo=UTC))
    )
    for i, entry in enumerate(entries, start=1):
        entry.rank = i

    response = LeaderboardResponse(
        contest_slug=slug,
        entries=entries,
        generated_at=datetime.now(UTC),
    )
    _lb_cache[slug] = (now_ts, response)
    return response
