"""Duel (1v1 chess-style) endpoints and WebSocket."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.dependencies import get_current_user
from app.judging import _elo_change
from app.models.duel import (
    Duel,
    DuelQueue,
    DuelQueueStatus,
    DuelRatingHistory,
    DuelRequest,
    DuelRequestStatus,
    DuelStatus,
)
from app.models.judging_job import JudgingJob
from app.models.problem import Problem, Visibility
from app.models.submission import Submission, Verdict
from app.models.user import User
from app.piston import SUPPORTED_LANGUAGES
from app.realtime import duel_hub, publish_duel_update
from app.schemas.duel import (
    ActiveDuelSummary,
    DuelPlayerState,
    DuelRatingHistoryEntry,
    DuelRead,
    DuelRequestCreate,
    DuelRequestRead,
    LobbyResponse,
    QueueEntryRead,
    QueueJoinRequest,
    RecentDuelSummary,
)

router = APIRouter(prefix="/api/duels", tags=["duels"])

_REQUEST_TTL_MINUTES = 30
_MAX_CODE_BYTES = 512 * 1024
_QUEUE_TTL_SECONDS = 300  # 5-minute queue expiry

_TIME_CONTROLS = [15, 30, 45, 60]


def _build_player_state(user: User, score: int, best_verdict: Verdict | None) -> DuelPlayerState:
    return DuelPlayerState(
        user_id=user.id,
        username=user.username,
        display_name=user.display_name,
        score=score,
        best_verdict=best_verdict,
        duel_rating=user.duel_rating,
    )


async def _best_verdict_in_duel(
    session: AsyncSession, duel_id: uuid.UUID, user_id: uuid.UUID
) -> Verdict | None:
    """Return the best verdict this user has achieved in this duel so far."""
    rows = await session.scalars(
        select(Submission.verdict).where(
            and_(Submission.duel_id == duel_id, Submission.user_id == user_id)
        )
    )
    verdicts = list(rows)
    if not verdicts:
        return None
    if Verdict.AC in verdicts:
        return Verdict.AC
    order = [
        Verdict.PARTIAL,
        Verdict.WA,
        Verdict.CE,
        Verdict.RE,
        Verdict.TLE,
        Verdict.MLE,
        Verdict.pending,
    ]
    for v in order:
        if v in verdicts:
            return v
    return verdicts[0]


async def _load_duel_read(session: AsyncSession, duel: Duel) -> DuelRead:
    challenger = await session.get(User, duel.challenger_id)
    opponent = await session.get(User, duel.opponent_id)
    problem = await session.get(Problem, duel.problem_id)

    c_verdict = await _best_verdict_in_duel(session, duel.id, duel.challenger_id)
    o_verdict = await _best_verdict_in_duel(session, duel.id, duel.opponent_id)

    return DuelRead(
        id=duel.id,
        status=duel.status,
        started_at=duel.started_at,
        finished_at=duel.finished_at,
        winner_id=duel.winner_id,
        time_limit_minutes=duel.time_limit_minutes,
        draw_offered_by=duel.draw_offered_by,
        draw_offered_at=duel.draw_offered_at,
        created_at=duel.created_at,
        problem_id=duel.problem_id,
        problem_slug=problem.slug if problem else "",
        problem_title=problem.title if problem else "",
        challenger=_build_player_state(challenger, duel.challenger_score, c_verdict),
        opponent=_build_player_state(opponent, duel.opponent_score, o_verdict),
    )


async def _finish_duel_draw(session: AsyncSession, duel: Duel) -> None:
    """Finalize a draw: update ratings, stats, mark finished."""
    now = datetime.now(UTC)
    duel.status = DuelStatus.drawn
    duel.finished_at = now
    duel.winner_id = None
    duel.draw_offered_by = None
    duel.draw_offered_at = None

    challenger = await session.get(User, duel.challenger_id)
    opponent = await session.get(User, duel.opponent_id)
    if challenger and opponent:
        c_change = _elo_change(challenger.duel_rating, opponent.duel_rating, 0.5)
        o_change = _elo_change(opponent.duel_rating, challenger.duel_rating, 0.5)
        session.add(
            DuelRatingHistory(
                user_id=challenger.id,
                duel_id=duel.id,
                rating_before=challenger.duel_rating,
                rating_after=max(0, challenger.duel_rating + c_change),
            )
        )
        session.add(
            DuelRatingHistory(
                user_id=opponent.id,
                duel_id=duel.id,
                rating_before=opponent.duel_rating,
                rating_after=max(0, opponent.duel_rating + o_change),
            )
        )
        challenger.duel_rating = max(0, challenger.duel_rating + c_change)
        opponent.duel_rating = max(0, opponent.duel_rating + o_change)
        challenger.duel_draws += 1
        opponent.duel_draws += 1


async def _finish_duel_resign(session: AsyncSession, duel: Duel, resigner_id: uuid.UUID) -> None:
    """Finalize a resignation: the other player wins."""
    now = datetime.now(UTC)
    duel.status = DuelStatus.resigned
    duel.finished_at = now
    winner_id = duel.opponent_id if resigner_id == duel.challenger_id else duel.challenger_id
    duel.winner_id = winner_id

    challenger = await session.get(User, duel.challenger_id)
    opponent = await session.get(User, duel.opponent_id)
    if challenger and opponent:
        winner_is_challenger = winner_id == challenger.id
        score_a = 1.0 if winner_is_challenger else 0.0
        c_change = _elo_change(challenger.duel_rating, opponent.duel_rating, score_a)
        o_change = _elo_change(opponent.duel_rating, challenger.duel_rating, 1.0 - score_a)
        session.add(
            DuelRatingHistory(
                user_id=challenger.id,
                duel_id=duel.id,
                rating_before=challenger.duel_rating,
                rating_after=max(0, challenger.duel_rating + c_change),
            )
        )
        session.add(
            DuelRatingHistory(
                user_id=opponent.id,
                duel_id=duel.id,
                rating_before=opponent.duel_rating,
                rating_after=max(0, opponent.duel_rating + o_change),
            )
        )
        challenger.duel_rating = max(0, challenger.duel_rating + c_change)
        opponent.duel_rating = max(0, opponent.duel_rating + o_change)
        if winner_is_challenger:
            challenger.duel_wins += 1
            opponent.duel_losses += 1
        else:
            opponent.duel_wins += 1
            challenger.duel_losses += 1


@router.post("/requests", response_model=DuelRequestRead, status_code=201)
async def send_duel_request(
    body: DuelRequestCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> DuelRequestRead:
    """Challenge another user to a duel."""
    if body.difficulty_min > body.difficulty_max:
        raise HTTPException(
            status_code=422, detail="difficulty_min trebuie să fie ≤ difficulty_max"
        )

    target = await session.scalar(select(User).where(User.username == body.to_username))
    if target is None:
        raise HTTPException(status_code=404, detail="Utilizatorul nu a fost găsit")
    if target.id == current_user.id:
        raise HTTPException(status_code=422, detail="Nu te poți provoca pe tine însuți")

    existing = await session.scalar(
        select(DuelRequest).where(
            and_(
                DuelRequest.from_id == current_user.id,
                DuelRequest.to_id == target.id,
                DuelRequest.status == DuelRequestStatus.pending,
            )
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=409, detail="Ai deja o provocare în așteptare către acest utilizator"
        )

    now = datetime.now(UTC)
    req = DuelRequest(
        from_id=current_user.id,
        to_id=target.id,
        time_limit_minutes=body.time_limit_minutes,
        difficulty_min=body.difficulty_min,
        difficulty_max=body.difficulty_max,
        status=DuelRequestStatus.pending,
        expires_at=now + timedelta(minutes=_REQUEST_TTL_MINUTES),
    )
    session.add(req)
    await session.commit()
    await session.refresh(req)

    return DuelRequestRead(
        id=req.id,
        from_id=req.from_id,
        from_username=current_user.username,
        to_id=req.to_id,
        to_username=target.username,
        time_limit_minutes=req.time_limit_minutes,
        difficulty_min=req.difficulty_min,
        difficulty_max=req.difficulty_max,
        status=req.status,
        created_at=req.created_at,
        expires_at=req.expires_at,
    )


@router.get("/requests/pending", response_model=list[DuelRequestRead])
async def list_pending_requests(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[DuelRequestRead]:
    """List incoming pending duel requests (with expiry check)."""
    now = datetime.now(UTC)
    rows = await session.scalars(
        select(DuelRequest)
        .where(
            and_(
                DuelRequest.to_id == current_user.id,
                DuelRequest.status == DuelRequestStatus.pending,
                DuelRequest.expires_at > now,
            )
        )
        .options(selectinload(DuelRequest.sender))
        .order_by(DuelRequest.created_at.desc())
    )
    requests = list(rows)

    result = []
    for req in requests:
        sender = req.sender
        result.append(
            DuelRequestRead(
                id=req.id,
                from_id=req.from_id,
                from_username=sender.username,
                to_id=req.to_id,
                to_username=current_user.username,
                time_limit_minutes=req.time_limit_minutes,
                difficulty_min=req.difficulty_min,
                difficulty_max=req.difficulty_max,
                status=req.status,
                created_at=req.created_at,
                expires_at=req.expires_at,
            )
        )
    return result


@router.post("/requests/{request_id}/accept", response_model=DuelRead, status_code=201)
async def accept_duel_request(
    request_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> DuelRead:
    """Accept a duel request. Picks a random matching problem and starts the duel."""
    now = datetime.now(UTC)
    req = await session.scalar(select(DuelRequest).where(DuelRequest.id == request_id))
    if req is None:
        raise HTTPException(status_code=404, detail="Cererea nu a fost găsită")
    if req.to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nu ai acces la această cerere")
    if req.status != DuelRequestStatus.pending:
        raise HTTPException(status_code=409, detail="Cererea nu mai este în așteptare")
    if req.expires_at <= now:
        req.status = DuelRequestStatus.expired
        await session.commit()
        raise HTTPException(status_code=410, detail="Cererea a expirat")

    problem = await session.scalar(
        select(Problem)
        .where(
            and_(
                Problem.visibility == Visibility.public,
                Problem.difficulty >= req.difficulty_min,
                Problem.difficulty <= req.difficulty_max,
            )
        )
        .order_by(func.random())
        .limit(1)
    )
    if problem is None:
        raise HTTPException(
            status_code=422,
            detail="Nu există probleme publice pentru dificultatea cerută",
        )

    req.status = DuelRequestStatus.accepted
    duel = Duel(
        challenger_id=req.from_id,
        opponent_id=req.to_id,
        problem_id=problem.id,
        status=DuelStatus.active,
        started_at=now,
        time_limit_minutes=req.time_limit_minutes,
    )
    session.add(duel)
    await session.commit()
    await session.refresh(duel)

    return await _load_duel_read(session, duel)


@router.post("/requests/{request_id}/decline", status_code=204)
async def decline_duel_request(
    request_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Decline a duel request."""
    req = await session.scalar(select(DuelRequest).where(DuelRequest.id == request_id))
    if req is None:
        raise HTTPException(status_code=404, detail="Cererea nu a fost găsită")
    if req.to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nu ai acces la această cerere")
    if req.status != DuelRequestStatus.pending:
        raise HTTPException(status_code=409, detail="Cererea nu mai este în așteptare")
    req.status = DuelRequestStatus.declined
    await session.commit()


@router.get("/{duel_id}", response_model=DuelRead)
async def get_duel(
    duel_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> DuelRead:
    """Get duel state. Only participants can view."""
    duel = await session.scalar(select(Duel).where(Duel.id == duel_id))
    if duel is None:
        raise HTTPException(status_code=404, detail="Duelul nu a fost găsit")
    if current_user.id not in (duel.challenger_id, duel.opponent_id):
        raise HTTPException(status_code=403, detail="Nu ești participant la acest duel")
    return await _load_duel_read(session, duel)


@router.post("/{duel_id}/submit", status_code=201)
async def duel_submit(
    duel_id: uuid.UUID,
    body: dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Submit code for a duel. Returns the submission_id for SSE tracking."""
    source_code = body.get("source_code", "")
    language = body.get("language", "")

    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=422,
            detail=f"Limbaj nesuportat: {language}",
        )
    if len(source_code.encode("utf-8")) > _MAX_CODE_BYTES:
        raise HTTPException(status_code=413, detail="Codul sursă este prea mare (max 512 KB)")

    duel = await session.scalar(select(Duel).where(Duel.id == duel_id))
    if duel is None:
        raise HTTPException(status_code=404, detail="Duelul nu a fost găsit")
    if current_user.id not in (duel.challenger_id, duel.opponent_id):
        raise HTTPException(status_code=403, detail="Nu ești participant la acest duel")
    if duel.status != DuelStatus.active:
        raise HTTPException(status_code=409, detail="Duelul nu mai este activ")

    now = datetime.now(UTC)
    if duel.started_at and now > duel.started_at + timedelta(minutes=duel.time_limit_minutes):
        raise HTTPException(status_code=409, detail="Timpul duelului a expirat")

    submission_id = uuid.uuid4()
    sub = Submission(
        id=submission_id,
        user_id=current_user.id,
        problem_id=duel.problem_id,
        duel_id=duel.id,
        submitted_code=source_code,
        language=language,
        verdict=Verdict.pending,
        score=0,
    )
    session.add(sub)
    session.add(JudgingJob(submission_id=submission_id))
    await session.commit()

    return {"submission_id": str(submission_id)}


@router.post("/{duel_id}/resign", status_code=204)
async def resign_duel(
    duel_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Resign from an active duel. Opponent wins immediately."""
    duel = await session.scalar(select(Duel).where(Duel.id == duel_id))
    if duel is None:
        raise HTTPException(status_code=404, detail="Duelul nu a fost găsit")
    if current_user.id not in (duel.challenger_id, duel.opponent_id):
        raise HTTPException(status_code=403, detail="Nu ești participant la acest duel")
    if duel.status != DuelStatus.active:
        raise HTTPException(status_code=409, detail="Duelul nu mai este activ")

    await _finish_duel_resign(session, duel, current_user.id)
    await publish_duel_update(session, str(duel.id))
    await session.commit()


@router.post("/{duel_id}/offer-draw", status_code=204)
async def offer_draw(
    duel_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Offer a draw to the opponent."""
    duel = await session.scalar(select(Duel).where(Duel.id == duel_id))
    if duel is None:
        raise HTTPException(status_code=404, detail="Duelul nu a fost găsit")
    if current_user.id not in (duel.challenger_id, duel.opponent_id):
        raise HTTPException(status_code=403, detail="Nu ești participant la acest duel")
    if duel.status != DuelStatus.active:
        raise HTTPException(status_code=409, detail="Duelul nu mai este activ")
    if duel.draw_offered_by is not None:
        raise HTTPException(status_code=409, detail="Există deja o ofertă de remiză în așteptare")

    duel.draw_offered_by = current_user.id
    duel.draw_offered_at = datetime.now(UTC)
    await publish_duel_update(session, str(duel.id))
    await session.commit()


_DRAW_OFFER_TTL_SECONDS = 60


@router.post("/{duel_id}/respond-draw", status_code=204)
async def respond_draw(
    duel_id: uuid.UUID,
    body: dict[str, Any],
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Accept or decline a draw offer. body: {"accept": true/false}"""
    accept = bool(body.get("accept", False))
    duel = await session.scalar(select(Duel).where(Duel.id == duel_id))
    if duel is None:
        raise HTTPException(status_code=404, detail="Duelul nu a fost găsit")
    if current_user.id not in (duel.challenger_id, duel.opponent_id):
        raise HTTPException(status_code=403, detail="Nu ești participant la acest duel")
    if duel.status != DuelStatus.active:
        raise HTTPException(status_code=409, detail="Duelul nu mai este activ")
    if duel.draw_offered_by is None:
        raise HTTPException(status_code=409, detail="Nu există o ofertă de remiză activă")
    if duel.draw_offered_by == current_user.id:
        raise HTTPException(status_code=422, detail="Nu îți poți răspunde propriei oferte")

    now = datetime.now(UTC)
    if (
        duel.draw_offered_at
        and (now - duel.draw_offered_at).total_seconds() > _DRAW_OFFER_TTL_SECONDS
    ):
        duel.draw_offered_by = None
        duel.draw_offered_at = None
        await publish_duel_update(session, str(duel.id))
        await session.commit()
        raise HTTPException(status_code=409, detail="Oferta de remiză a expirat")

    if accept:
        await _finish_duel_draw(session, duel)
    else:
        duel.draw_offered_by = None
        duel.draw_offered_at = None

    await publish_duel_update(session, str(duel.id))
    await session.commit()


@router.get("/{duel_id}/rating-history", response_model=list[DuelRatingHistoryEntry])
async def get_rating_history(
    username: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[DuelRatingHistoryEntry]:
    """Last 20 duel rating changes for a user."""
    target = await session.scalar(select(User).where(User.username == username))
    if target is None:
        raise HTTPException(status_code=404, detail="Utilizatorul nu a fost găsit")

    rows = await session.scalars(
        select(DuelRatingHistory)
        .where(DuelRatingHistory.user_id == target.id)
        .order_by(DuelRatingHistory.created_at.desc())
        .limit(20)
    )
    return list(rows)


@router.get("/lobby", response_model=LobbyResponse)
async def get_lobby(
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(lambda: None),
) -> LobbyResponse:
    """Public lobby: queue counts, active duels, recent finished duels."""

    return await _build_lobby(session, None)


@router.get("/lobby/me", response_model=LobbyResponse)
async def get_lobby_me(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> LobbyResponse:
    """Lobby including the current user's queue entry."""
    return await _build_lobby(session, current_user)


async def _build_lobby(session: AsyncSession, current_user: User | None) -> LobbyResponse:
    now = datetime.now(UTC)

    # Queue counts per time control
    queue_rows = await session.execute(
        select(DuelQueue.time_limit_minutes, func.count().label("n"))
        .where(DuelQueue.status == DuelQueueStatus.waiting, DuelQueue.expires_at > now)
        .group_by(DuelQueue.time_limit_minutes)
    )
    queue_counts: dict[int, int] = {t: 0 for t in _TIME_CONTROLS}
    for row in queue_rows:
        queue_counts[row.time_limit_minutes] = row.n

    # Active duels
    active_rows = (
        await session.scalars(
            select(Duel)
            .where(Duel.status == DuelStatus.active)
            .options(
                selectinload(Duel.challenger),
                selectinload(Duel.opponent),
                selectinload(Duel.problem),
            )
            .order_by(Duel.started_at.desc())
            .limit(20)
        )
    ).all()

    active_duels = []
    for d in active_rows:
        elapsed = int((now - d.started_at).total_seconds()) if d.started_at else 0
        active_duels.append(
            ActiveDuelSummary(
                id=d.id,
                challenger_username=d.challenger.username,
                challenger_rating=d.challenger.duel_rating,
                opponent_username=d.opponent.username,
                opponent_rating=d.opponent.duel_rating,
                problem_title=d.problem.title,
                time_limit_minutes=d.time_limit_minutes,
                seconds_elapsed=elapsed,
            )
        )

    # Recent finished duels
    recent_rows = (
        await session.scalars(
            select(Duel)
            .where(Duel.status.in_([DuelStatus.finished, DuelStatus.resigned, DuelStatus.drawn]))
            .options(
                selectinload(Duel.challenger),
                selectinload(Duel.opponent),
                selectinload(Duel.winner),
                selectinload(Duel.problem),
            )
            .order_by(Duel.finished_at.desc())
            .limit(15)
        )
    ).all()

    recent_duels = [
        RecentDuelSummary(
            id=d.id,
            challenger_username=d.challenger.username,
            challenger_rating=d.challenger.duel_rating,
            opponent_username=d.opponent.username,
            opponent_rating=d.opponent.duel_rating,
            winner_username=d.winner.username if d.winner else None,
            status=d.status,
            problem_title=d.problem.title,
            finished_at=d.finished_at,  # type: ignore[arg-type]
        )
        for d in recent_rows
    ]

    # Current user's queue entry
    your_entry: QueueEntryRead | None = None
    if current_user is not None:
        entry = await session.scalar(
            select(DuelQueue).where(
                DuelQueue.user_id == current_user.id,
                DuelQueue.status == DuelQueueStatus.waiting,
                DuelQueue.expires_at > now,
            )
        )
        if entry:
            your_entry = QueueEntryRead(
                id=entry.id,
                user_id=entry.user_id,
                time_limit_minutes=entry.time_limit_minutes,
                joined_at=entry.joined_at,
                expires_at=entry.expires_at,
                status=entry.status,
                matched_duel_id=entry.matched_duel_id,
            )

    return LobbyResponse(
        queue_counts=queue_counts,
        active_duels=active_duels,
        recent_duels=recent_duels,
        your_queue_entry=your_entry,
    )


@router.post("/queue/join", response_model=QueueEntryRead, status_code=201)
async def join_queue(
    body: QueueJoinRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> QueueEntryRead:
    """Join the matchmaking queue for a given time control."""
    if body.time_limit_minutes not in _TIME_CONTROLS:
        raise HTTPException(
            status_code=422,
            detail=f"Format de timp invalid. Valori acceptate: {_TIME_CONTROLS}",
        )

    now = datetime.now(UTC)

    # Check if already in active duel
    active = await session.scalar(
        select(Duel).where(
            and_(
                Duel.status == DuelStatus.active,
                (Duel.challenger_id == current_user.id) | (Duel.opponent_id == current_user.id),
            )
        )
    )
    if active is not None:
        raise HTTPException(status_code=409, detail="Ești deja într-un duel activ")

    # Cancel any existing queue entry
    existing = await session.scalar(
        select(DuelQueue).where(
            DuelQueue.user_id == current_user.id,
            DuelQueue.status == DuelQueueStatus.waiting,
        )
    )
    if existing is not None:
        existing.status = DuelQueueStatus.cancelled
        await session.flush()

    entry = DuelQueue(
        user_id=current_user.id,
        time_limit_minutes=body.time_limit_minutes,
        joined_at=now,
        expires_at=now + timedelta(seconds=_QUEUE_TTL_SECONDS),
        status=DuelQueueStatus.waiting,
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)

    return QueueEntryRead(
        id=entry.id,
        user_id=entry.user_id,
        time_limit_minutes=entry.time_limit_minutes,
        joined_at=entry.joined_at,
        expires_at=entry.expires_at,
        status=entry.status,
        matched_duel_id=entry.matched_duel_id,
    )


@router.delete("/queue/leave", status_code=204)
async def leave_queue(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Leave the matchmaking queue."""
    entry = await session.scalar(
        select(DuelQueue).where(
            DuelQueue.user_id == current_user.id,
            DuelQueue.status == DuelQueueStatus.waiting,
        )
    )
    if entry is not None:
        entry.status = DuelQueueStatus.cancelled
        await session.commit()


@router.get("/queue/status", response_model=QueueEntryRead | None)
async def get_queue_status(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> QueueEntryRead | None:
    """Get current queue or matched entry for the authenticated user."""
    now = datetime.now(UTC)
    entry = await session.scalar(
        select(DuelQueue).where(
            DuelQueue.user_id == current_user.id,
            DuelQueue.status.in_([DuelQueueStatus.waiting, DuelQueueStatus.matched]),
            DuelQueue.expires_at > now,
        )
    )
    if entry is None:
        return None
    return QueueEntryRead(
        id=entry.id,
        user_id=entry.user_id,
        time_limit_minutes=entry.time_limit_minutes,
        joined_at=entry.joined_at,
        expires_at=entry.expires_at,
        status=entry.status,
        matched_duel_id=entry.matched_duel_id,
    )


@router.get("/users/{username}/rating-history", response_model=list[DuelRatingHistoryEntry])
async def get_user_rating_history(
    username: str,
    session: AsyncSession = Depends(get_session),
) -> list[DuelRatingHistoryEntry]:
    """Last 20 duel rating changes for a user (public endpoint)."""
    target = await session.scalar(select(User).where(User.username == username))
    if target is None:
        raise HTTPException(status_code=404, detail="Utilizatorul nu a fost găsit")

    rows = await session.scalars(
        select(DuelRatingHistory)
        .where(DuelRatingHistory.user_id == target.id)
        .order_by(DuelRatingHistory.created_at.asc())
        .limit(20)
    )
    return list(rows)


@router.websocket("/{duel_id}/ws")
async def duel_ws(
    duel_id: uuid.UUID,
    websocket: WebSocket,
    session: AsyncSession = Depends(get_session),
) -> None:
    """WebSocket for real-time duel state (verdict updates, draw offers, timer)."""
    duel = await session.scalar(select(Duel).where(Duel.id == duel_id))
    if duel is None:
        await websocket.close(code=4404)
        return

    token = websocket.cookies.get("reinfo_session")
    if token is None:
        await websocket.close(code=4401)
        return

    from app.models.user import Session as UserSession

    db_session = await session.scalar(
        select(UserSession).where(
            UserSession.token == token,
            UserSession.expires_at > datetime.now(UTC),
        )
    )
    if db_session is None:
        await websocket.close(code=4401)
        return

    user = await session.get(User, db_session.user_id)
    if user is None or user.id not in (duel.challenger_id, duel.opponent_id):
        await websocket.close(code=4403)
        return

    await websocket.accept()
    key = str(duel_id)
    await duel_hub.connect(key, websocket)

    snapshot = await _load_duel_read(session, duel)
    await websocket.send_json({"type": "state", "data": snapshot.model_dump(mode="json")})

    if duel.started_at:
        seconds_remaining = int(
            (
                duel.started_at + timedelta(minutes=duel.time_limit_minutes) - datetime.now(UTC)
            ).total_seconds()
        )
        await websocket.send_json({"type": "timer", "seconds_remaining": max(0, seconds_remaining)})

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await duel_hub.disconnect(key, websocket)


async def dispatch_duel_update(duel_id_str: str) -> None:
    """Called by the Postgres NOTIFY listener. Rebuilds and broadcasts duel state."""
    from app.db import async_session_factory

    try:
        duel_id = uuid.UUID(duel_id_str)
    except ValueError:
        return

    async with async_session_factory() as session:
        duel = await session.scalar(select(Duel).where(Duel.id == duel_id))
        if duel is None:
            return

        snapshot = await _load_duel_read(session, duel)
        payload: dict[str, Any] = {"type": "state", "data": snapshot.model_dump(mode="json")}

        if duel.started_at and duel.status == DuelStatus.active:
            seconds_remaining = int(
                (
                    duel.started_at + timedelta(minutes=duel.time_limit_minutes) - datetime.now(UTC)
                ).total_seconds()
            )
            payload["seconds_remaining"] = max(0, seconds_remaining)

        await duel_hub.broadcast(str(duel_id), payload)
