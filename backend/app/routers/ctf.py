"""ctf challenge endpoints: browsing, flag submission, hints, attachments"""

import math
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.ctf_scoring import compute_points, current_value
from app.db import get_session
from app.dependencies import get_current_user, get_optional_user
from app.limiter import limiter
from app.models.ctf import (
    CtfAttachment,
    CtfChallenge,
    CtfFlagAttempt,
    CtfHint,
    CtfHintReveal,
    CtfSolve,
)
from app.models.user import User, UserRole
from app.schemas.ctf import (
    CtfAttachmentRead,
    CtfChallengeCreate,
    CtfChallengeDetail,
    CtfChallengeListResponse,
    CtfChallengeSummary,
    CtfChallengeUpdate,
    CtfFlagSubmitRequest,
    CtfFlagSubmitResult,
    CtfHintCreate,
    CtfHintRead,
    CtfScoreboardEntry,
    CtfScoreboardResponse,
)
from app.security import hash_flag, verify_flag
from app.storage import delete_ctf_attachment, read_ctf_attachment, save_ctf_attachment

router = APIRouter(prefix="/api/ctf", tags=["ctf"])

_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024  # 25 MB

_FREE_WRONG_ATTEMPTS = 3
_BASE_COOLDOWN_SECONDS = 10
_MAX_COOLDOWN_SECONDS = 3600


def _required_cooldown_seconds(prior_wrong_count: int) -> int:
    """escalating cooldown after repeated wrong guesses, 0 while under the free-attempt budget"""
    if prior_wrong_count <= _FREE_WRONG_ATTEMPTS:
        return 0
    exponent = prior_wrong_count - _FREE_WRONG_ATTEMPTS
    return min(_MAX_COOLDOWN_SECONDS, _BASE_COOLDOWN_SECONDS * (2**exponent))


def _can_view(challenge: CtfChallenge, user: User | None) -> bool:
    if challenge.published:
        return True
    if user is None:
        return False
    return user.role in (UserRole.admin, UserRole.superuser) or challenge.author_id == user.id


def _can_edit(challenge: CtfChallenge, user: User) -> bool:
    return user.role in (UserRole.admin, UserRole.superuser) or challenge.author_id == user.id


async def _get_challenge_or_404(
    slug: str, session: AsyncSession, user: User | None
) -> CtfChallenge:
    challenge = await session.scalar(select(CtfChallenge).where(CtfChallenge.slug == slug))
    if challenge is None or not _can_view(challenge, user):
        raise HTTPException(status_code=404, detail="Provocarea nu a fost găsită")
    return challenge


def _solve_count_subquery():
    return (
        select(CtfSolve.challenge_id, func.count().label("solve_count"))
        .group_by(CtfSolve.challenge_id)
        .subquery()
    )


def _first_blood_subquery():
    """one row per challenge: the username of whoever solved it first"""
    ranked = (
        select(
            CtfSolve.challenge_id,
            User.username.label("username"),
            func.row_number()
            .over(partition_by=CtfSolve.challenge_id, order_by=CtfSolve.solved_at.asc())
            .label("rn"),
        )
        .join(User, User.id == CtfSolve.user_id)
        .subquery()
    )
    return select(ranked.c.challenge_id, ranked.c.username).where(ranked.c.rn == 1).subquery()


@router.get("", response_model=CtfChallengeListResponse)
async def list_challenges(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    category: str | None = Query(None),
    difficulty_min: int | None = Query(None, ge=1, le=10),
    difficulty_max: int | None = Query(None, ge=1, le=10),
    solved: bool | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> CtfChallengeListResponse:
    """list published ctf challenges (plus your own, for author/admin)"""
    if solved is not None and current_user is None:
        raise HTTPException(
            status_code=401, detail="Autentificare necesară pentru filtrarea după status"
        )

    solve_sq = _solve_count_subquery()
    fb_sq = _first_blood_subquery()
    stmt = (
        select(
            CtfChallenge,
            func.coalesce(solve_sq.c.solve_count, 0).label("solve_count"),
            fb_sq.c.username.label("first_blood_username"),
        )
        .outerjoin(solve_sq, CtfChallenge.id == solve_sq.c.challenge_id)
        .outerjoin(fb_sq, CtfChallenge.id == fb_sq.c.challenge_id)
    )

    if current_user is None:
        stmt = stmt.where(CtfChallenge.published.is_(True))
    elif current_user.role not in (UserRole.admin, UserRole.superuser):
        stmt = stmt.where(
            (CtfChallenge.published.is_(True)) | (CtfChallenge.author_id == current_user.id)
        )

    if category is not None:
        stmt = stmt.where(CtfChallenge.category == category)
    if difficulty_min is not None:
        stmt = stmt.where(CtfChallenge.difficulty >= difficulty_min)
    if difficulty_max is not None:
        stmt = stmt.where(CtfChallenge.difficulty <= difficulty_max)

    solved_ids: set[uuid.UUID] = set()
    if current_user is not None:
        rows = (
            await session.execute(
                select(CtfSolve.challenge_id).where(CtfSolve.user_id == current_user.id)
            )
        ).all()
        solved_ids = {r[0] for r in rows}
        if solved is True:
            stmt = stmt.where(CtfChallenge.id.in_(solved_ids))
        elif solved is False:
            stmt = stmt.where(CtfChallenge.id.notin_(solved_ids))

    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0

    stmt = (
        stmt.order_by(CtfChallenge.difficulty.asc(), CtfChallenge.created_at.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    rows = (await session.execute(stmt)).all()

    items = [
        CtfChallengeSummary(
            id=c.id,
            slug=c.slug,
            title=c.title,
            category=c.category,
            difficulty=c.difficulty,
            scoring=c.scoring,
            base_points=c.base_points,
            current_points=current_value(c.base_points, c.scoring, solve_count),
            solve_count=solve_count,
            published=c.published,
            solved_by_user=(c.id in solved_ids) if current_user is not None else None,
            first_blood_username=first_blood_username,
            created_at=c.created_at,
        )
        for c, solve_count, first_blood_username in rows
    ]

    pages = math.ceil(total / per_page) if total > 0 else 0
    return CtfChallengeListResponse(
        items=items, total=total, page=page, per_page=per_page, pages=pages
    )


@router.get("/scoreboard", response_model=CtfScoreboardResponse)
async def get_scoreboard(session: AsyncSession = Depends(get_session)) -> CtfScoreboardResponse:
    """ctf scoreboard: total points, tiebroken by most recent solve; registered before /{slug} to avoid slug collision"""
    rows = (
        await session.execute(
            select(
                CtfSolve.user_id,
                User.username,
                User.display_name,
                User.avatar_url,
                func.sum(CtfSolve.points_awarded).label("total_points"),
                func.count().label("solve_count"),
                func.max(CtfSolve.solved_at).label("last_solved_at"),
            )
            .join(User, User.id == CtfSolve.user_id)
            .group_by(CtfSolve.user_id, User.username, User.display_name, User.avatar_url)
            .order_by(func.sum(CtfSolve.points_awarded).desc(), func.max(CtfSolve.solved_at).asc())
        )
    ).all()

    category_rows = (
        await session.execute(
            select(
                CtfSolve.user_id,
                CtfChallenge.category,
                func.sum(CtfSolve.points_awarded).label("points"),
            )
            .join(CtfChallenge, CtfChallenge.id == CtfSolve.challenge_id)
            .group_by(CtfSolve.user_id, CtfChallenge.category)
        )
    ).all()
    category_by_user: dict[uuid.UUID, dict[str, int]] = {}
    for user_id, category, points in category_rows:
        category_by_user.setdefault(user_id, {})[category.value] = points

    entries = [
        CtfScoreboardEntry(
            rank=i + 1,
            user_id=row.user_id,
            username=row.username,
            display_name=row.display_name,
            avatar_url=row.avatar_url,
            total_points=row.total_points,
            solve_count=row.solve_count,
            last_solved_at=row.last_solved_at,
            category_points=category_by_user.get(row.user_id, {}),
        )
        for i, row in enumerate(rows)
    ]
    return CtfScoreboardResponse(entries=entries, generated_at=datetime.now(UTC))


@router.post("", response_model=CtfChallengeDetail, status_code=201)
async def create_challenge(
    data: CtfChallengeCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CtfChallengeDetail:
    """create a new ctf challenge, requires the teacher or admin role"""
    if current_user.role not in (UserRole.teacher, UserRole.admin, UserRole.superuser):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    existing = await session.scalar(select(CtfChallenge).where(CtfChallenge.slug == data.slug))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Există deja o provocare cu acest slug")

    challenge = CtfChallenge(
        slug=data.slug,
        title=data.title,
        statement_md=data.statement_md,
        category=data.category,
        difficulty=data.difficulty,
        base_points=data.base_points,
        scoring=data.scoring,
        flag_hash=hash_flag(data.flag, data.flag_case_sensitive),
        flag_case_sensitive=data.flag_case_sensitive,
        published=data.published,
        author_id=current_user.id,
    )
    session.add(challenge)
    await session.commit()
    await session.refresh(challenge)
    return await _to_detail(challenge, session, current_user)


@router.get("/{slug}", response_model=CtfChallengeDetail)
async def get_challenge(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> CtfChallengeDetail:
    """details of a ctf challenge, including hints and attachments"""
    challenge = await _get_challenge_or_404(slug, session, current_user)
    return await _to_detail(challenge, session, current_user)


@router.patch("/{slug}", response_model=CtfChallengeDetail)
async def update_challenge(
    slug: str,
    data: CtfChallengeUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CtfChallengeDetail:
    """edit a ctf challenge, author or admin only"""
    challenge = await _get_challenge_or_404(slug, session, current_user)
    if not _can_edit(challenge, current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    updates = data.model_dump(exclude_unset=True, exclude={"flag"})
    for field, value in updates.items():
        setattr(challenge, field, value)

    if data.flag is not None:
        case_sensitive = (
            data.flag_case_sensitive
            if data.flag_case_sensitive is not None
            else challenge.flag_case_sensitive
        )
        challenge.flag_hash = hash_flag(data.flag, case_sensitive)

    await session.commit()
    await session.refresh(challenge)
    return await _to_detail(challenge, session, current_user)


@router.delete("/{slug}", status_code=200)
async def delete_challenge(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """hide the challenge (soft-delete: published -> false), author or admin only"""
    challenge = await _get_challenge_or_404(slug, session, current_user)
    if not _can_edit(challenge, current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")
    challenge.published = False
    await session.commit()
    return {"message": "Provocarea a fost ascunsă"}


async def _to_detail(
    challenge: CtfChallenge, session: AsyncSession, current_user: User | None
) -> CtfChallengeDetail:
    solve_count = (
        await session.scalar(select(func.count()).where(CtfSolve.challenge_id == challenge.id)) or 0
    )

    solved_by_user = None
    revealed_hint_ids: set[uuid.UUID] = set()
    if current_user is not None:
        solved_by_user = (
            await session.scalar(
                select(CtfSolve.id).where(
                    CtfSolve.challenge_id == challenge.id, CtfSolve.user_id == current_user.id
                )
            )
        ) is not None
        rows = (
            await session.execute(
                select(CtfHintReveal.hint_id)
                .join(CtfHint, CtfHint.id == CtfHintReveal.hint_id)
                .where(
                    CtfHint.challenge_id == challenge.id, CtfHintReveal.user_id == current_user.id
                )
            )
        ).all()
        revealed_hint_ids = {r[0] for r in rows}

    first_blood_row = await session.scalar(
        select(User.username)
        .join(CtfSolve, CtfSolve.user_id == User.id)
        .where(CtfSolve.challenge_id == challenge.id)
        .order_by(CtfSolve.solved_at.asc())
        .limit(1)
    )

    attachments = (
        await session.scalars(
            select(CtfAttachment).where(CtfAttachment.challenge_id == challenge.id)
        )
    ).all()
    hints = (
        await session.scalars(
            select(CtfHint).where(CtfHint.challenge_id == challenge.id).order_by(CtfHint.ordinal)
        )
    ).all()

    is_editor = current_user is not None and _can_edit(challenge, current_user)

    return CtfChallengeDetail(
        id=challenge.id,
        slug=challenge.slug,
        title=challenge.title,
        category=challenge.category,
        difficulty=challenge.difficulty,
        scoring=challenge.scoring,
        base_points=challenge.base_points,
        current_points=current_value(challenge.base_points, challenge.scoring, solve_count),
        solve_count=solve_count,
        published=challenge.published,
        solved_by_user=solved_by_user,
        first_blood_username=first_blood_row,
        created_at=challenge.created_at,
        statement_md=challenge.statement_md,
        flag_case_sensitive=challenge.flag_case_sensitive,
        attachments=[CtfAttachmentRead.model_validate(a) for a in attachments],
        hints=[
            CtfHintRead(
                id=h.id,
                ordinal=h.ordinal,
                cost=h.cost,
                revealed=is_editor or h.id in revealed_hint_ids,
                content_md=h.content_md if (is_editor or h.id in revealed_hint_ids) else None,
            )
            for h in hints
        ],
    )


@router.post("/{slug}/submit-flag", response_model=CtfFlagSubmitResult)
@limiter.limit("5/minute")
async def submit_flag(
    request: Request,
    slug: str,
    data: CtfFlagSubmitRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CtfFlagSubmitResult:
    """submit a flag for a ctf challenge; rate-limited, idempotent once solved"""
    challenge = await _get_challenge_or_404(slug, session, current_user)

    existing_solve = await session.scalar(
        select(CtfSolve).where(
            CtfSolve.challenge_id == challenge.id, CtfSolve.user_id == current_user.id
        )
    )
    if existing_solve is not None:
        return CtfFlagSubmitResult(
            correct=True,
            already_solved=True,
            first_blood=False,
            points_awarded=existing_solve.points_awarded,
            message="Ai rezolvat deja această provocare",
        )

    last_attempt = await session.scalar(
        select(CtfFlagAttempt)
        .where(
            CtfFlagAttempt.challenge_id == challenge.id,
            CtfFlagAttempt.user_id == current_user.id,
        )
        .order_by(CtfFlagAttempt.submitted_at.desc())
        .limit(1)
    )
    wrong_count = (
        await session.scalar(
            select(func.count()).where(
                CtfFlagAttempt.challenge_id == challenge.id,
                CtfFlagAttempt.user_id == current_user.id,
                CtfFlagAttempt.correct.is_(False),
            )
        )
        or 0
    )

    if last_attempt is not None:
        cooldown = _required_cooldown_seconds(wrong_count)
        elapsed = (datetime.now(UTC) - last_attempt.submitted_at).total_seconds()
        if elapsed < cooldown:
            retry_after = max(1, round(cooldown - elapsed))
            raise HTTPException(
                status_code=429,
                detail=f"Prea multe încercări greșite. Mai încearcă în {retry_after}s",
                headers={"Retry-After": str(retry_after)},
            )

    is_correct = verify_flag(data.flag, challenge.flag_hash, challenge.flag_case_sensitive)
    session.add(
        CtfFlagAttempt(challenge_id=challenge.id, user_id=current_user.id, correct=is_correct)
    )

    if not is_correct:
        await session.commit()
        return CtfFlagSubmitResult(
            correct=False, already_solved=False, first_blood=False, message="Flag incorect"
        )

    solves_before = (
        await session.scalar(select(func.count()).where(CtfSolve.challenge_id == challenge.id)) or 0
    )
    first_blood = solves_before == 0

    hint_cost = (
        await session.scalar(
            select(func.coalesce(func.sum(CtfHint.cost), 0))
            .select_from(CtfHintReveal)
            .join(CtfHint, CtfHint.id == CtfHintReveal.hint_id)
            .where(CtfHint.challenge_id == challenge.id, CtfHintReveal.user_id == current_user.id)
        )
        or 0
    )

    points = compute_points(challenge.base_points, challenge.scoring, solves_before, hint_cost)

    try:
        session.add(
            CtfSolve(challenge_id=challenge.id, user_id=current_user.id, points_awarded=points)
        )
        await session.commit()
    except IntegrityError:
        await session.rollback()
        existing = await session.scalar(
            select(CtfSolve).where(
                CtfSolve.challenge_id == challenge.id, CtfSolve.user_id == current_user.id
            )
        )
        return CtfFlagSubmitResult(
            correct=True,
            already_solved=True,
            first_blood=False,
            points_awarded=existing.points_awarded if existing else None,
            message="Ai rezolvat deja această provocare",
        )

    return CtfFlagSubmitResult(
        correct=True,
        already_solved=False,
        first_blood=first_blood,
        points_awarded=points,
        message="Corect!",
    )


@router.post("/{slug}/hints", response_model=CtfHintRead, status_code=201)
async def create_hint(
    slug: str,
    data: CtfHintCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CtfHintRead:
    """add a hint to a challenge, author or admin only"""
    challenge = await _get_challenge_or_404(slug, session, current_user)
    if not _can_edit(challenge, current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    hint = CtfHint(
        challenge_id=challenge.id, content_md=data.content_md, cost=data.cost, ordinal=data.ordinal
    )
    session.add(hint)
    await session.commit()
    await session.refresh(hint)
    return CtfHintRead(
        id=hint.id, ordinal=hint.ordinal, cost=hint.cost, revealed=True, content_md=hint.content_md
    )


@router.delete("/{slug}/hints/{hint_id}", status_code=200)
async def delete_hint(
    slug: str,
    hint_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """delete a hint, author or admin only"""
    challenge = await _get_challenge_or_404(slug, session, current_user)
    if not _can_edit(challenge, current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")
    hint = await session.scalar(
        select(CtfHint).where(CtfHint.id == hint_id, CtfHint.challenge_id == challenge.id)
    )
    if hint is None:
        raise HTTPException(status_code=404, detail="Indiciul nu a fost găsit")
    await session.delete(hint)
    await session.commit()
    return {"message": "Indiciul a fost șters"}


@router.post("/{slug}/hints/{hint_id}/reveal", response_model=CtfHintRead)
async def reveal_hint(
    slug: str,
    hint_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CtfHintRead:
    """reveal a hint's content; its cost is deducted from the score on solve"""
    challenge = await _get_challenge_or_404(slug, session, current_user)
    hint = await session.scalar(
        select(CtfHint).where(CtfHint.id == hint_id, CtfHint.challenge_id == challenge.id)
    )
    if hint is None:
        raise HTTPException(status_code=404, detail="Indiciul nu a fost găsit")

    existing = await session.scalar(
        select(CtfHintReveal).where(
            CtfHintReveal.hint_id == hint.id, CtfHintReveal.user_id == current_user.id
        )
    )
    if existing is None:
        session.add(CtfHintReveal(hint_id=hint.id, user_id=current_user.id))
        await session.commit()

    return CtfHintRead(
        id=hint.id, ordinal=hint.ordinal, cost=hint.cost, revealed=True, content_md=hint.content_md
    )


@router.post("/{slug}/attachments", response_model=CtfAttachmentRead, status_code=201)
async def upload_attachment(
    slug: str,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CtfAttachmentRead:
    """upload a file attached to a challenge, author or admin only"""
    challenge = await _get_challenge_or_404(slug, session, current_user)
    if not _can_edit(challenge, current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")
    if not file.filename:
        raise HTTPException(status_code=422, detail="Fișierul trebuie să aibă un nume")

    data = await file.read()
    if len(data) > _MAX_ATTACHMENT_BYTES:
        raise HTTPException(status_code=413, detail="Fișier prea mare (max 25 MB)")

    path = await save_ctf_attachment(challenge.id, file.filename, data)
    attachment = CtfAttachment(challenge_id=challenge.id, filename=file.filename, path=path)
    session.add(attachment)
    await session.commit()
    await session.refresh(attachment)
    return CtfAttachmentRead.model_validate(attachment)


@router.delete("/{slug}/attachments/{attachment_id}", status_code=200)
async def delete_attachment(
    slug: str,
    attachment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """delete an attached file, author or admin only"""
    challenge = await _get_challenge_or_404(slug, session, current_user)
    if not _can_edit(challenge, current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")
    attachment = await session.scalar(
        select(CtfAttachment).where(
            CtfAttachment.id == attachment_id, CtfAttachment.challenge_id == challenge.id
        )
    )
    if attachment is None:
        raise HTTPException(status_code=404, detail="Atașamentul nu a fost găsit")
    await delete_ctf_attachment(attachment.path)
    await session.delete(attachment)
    await session.commit()
    return {"message": "Atașamentul a fost șters"}


@router.get("/{slug}/attachments/{attachment_id}/download")
async def download_attachment(
    slug: str,
    attachment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> Response:
    """download a file attached to a published challenge (or one visible to the author/admin)"""
    challenge = await _get_challenge_or_404(slug, session, current_user)
    attachment = await session.scalar(
        select(CtfAttachment).where(
            CtfAttachment.id == attachment_id, CtfAttachment.challenge_id == challenge.id
        )
    )
    if attachment is None:
        raise HTTPException(status_code=404, detail="Atașamentul nu a fost găsit")

    try:
        content = await read_ctf_attachment(attachment.path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Fișierul nu a fost găsit pe disc") from None

    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{attachment.filename}"'},
    )
