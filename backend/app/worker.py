"""background worker that polls for queued judging jobs and processes them; run with `python -m app.worker`"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import selectinload

from app.config import settings
from app.contest_rating import RatingEntrant, compute_rating_deltas
from app.judging import _elo_change, judge_submission
from app.leaderboard import build_leaderboard
from app.models.classroom import Class as _Class  # noqa: F401
from app.models.contest import Contest, ContestRatingHistory
from app.models.duel import Duel, DuelQueue, DuelQueueStatus, DuelRatingHistory, DuelStatus
from app.models.judging_job import JobStatus, JudgingJob
from app.models.problem import Problem, Visibility
from app.models.user import User
from app.realtime import publish_duel_update

log = logging.getLogger(__name__)

_POLL_INTERVAL = 0.5


async def process_one_job(session: AsyncSession) -> bool:
    """claim and process one queued job, returns true if a job was claimed and processed"""
    job = await session.scalar(
        select(JudgingJob)
        .where(JudgingJob.status == JobStatus.queued)
        .order_by(JudgingJob.created_at)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    if job is None:
        await session.rollback()
        return False

    job_id = job.id
    submission_id = job.submission_id
    job.status = JobStatus.running
    job.started_at = datetime.now(UTC)
    job.attempts += 1
    await session.commit()

    error: str | None = None
    try:
        await judge_submission(submission_id, session)
    except Exception as exc:
        log.exception("judging failed for submission %s", submission_id)
        error = str(exc)[:1000]
        await session.rollback()

    job = await session.get(JudgingJob, job_id)
    if job is not None:
        job.status = JobStatus.failed if error else JobStatus.done
        job.finished_at = datetime.now(UTC)
        if error:
            job.last_error = error
        await session.commit()

    return True


_DRAW_OFFER_TTL_SECONDS = 60


async def process_expired_duels(session: AsyncSession) -> None:
    """finish any active duels whose timer has run out"""
    now = datetime.now(UTC)
    active_duels = (
        await session.scalars(
            select(Duel).where(
                Duel.status == DuelStatus.active,
                Duel.started_at.isnot(None),
            )
        )
    ).all()

    for duel in active_duels:
        # expire stale draw offers
        if duel.draw_offered_at is not None:
            age = (now - duel.draw_offered_at).total_seconds()
            if age > _DRAW_OFFER_TTL_SECONDS:
                duel.draw_offered_by = None
                duel.draw_offered_at = None
                await publish_duel_update(session, str(duel.id))
                await session.commit()

    for duel in active_duels:
        if duel.started_at is None:
            continue
        deadline = duel.started_at + timedelta(minutes=duel.time_limit_minutes)
        if now < deadline:
            continue

        duel.finished_at = now
        duel.draw_offered_by = None
        duel.draw_offered_at = None
        challenger = await session.get(User, duel.challenger_id)
        opponent = await session.get(User, duel.opponent_id)

        if challenger is None or opponent is None:
            duel.status = DuelStatus.finished
            await session.commit()
            continue

        c_score = duel.challenger_score
        o_score = duel.opponent_score

        if c_score > o_score:
            duel.status = DuelStatus.finished
            duel.winner_id = duel.challenger_id
            score_a = 1.0
        elif o_score > c_score:
            duel.status = DuelStatus.finished
            duel.winner_id = duel.opponent_id
            score_a = 0.0
        else:
            duel.status = DuelStatus.drawn
            duel.winner_id = None
            score_a = 0.5

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

        if score_a == 1.0:
            challenger.duel_wins += 1
            opponent.duel_losses += 1
        elif score_a == 0.0:
            opponent.duel_wins += 1
            challenger.duel_losses += 1
        else:
            challenger.duel_draws += 1
            opponent.duel_draws += 1

        await publish_duel_update(session, str(duel.id))
        await session.commit()


_QUEUE_TTL_SECONDS = 300  # 5-minute queue expiry


def _difficulty_for_elo(avg_elo: int) -> tuple[int, int]:
    """map average player elo to a 2-wide problem difficulty range"""
    center = max(1, min(9, round((avg_elo - 800) / 80) + 1))
    return (center, min(10, center + 1))


async def process_duel_queue(session: AsyncSession) -> None:
    """expire stale queue entries, then match waiting players by elo proximity"""
    now = datetime.now(UTC)

    # expire entries that timed out
    await session.execute(
        update(DuelQueue)
        .where(DuelQueue.status == DuelQueueStatus.waiting, DuelQueue.expires_at <= now)
        .values(status=DuelQueueStatus.cancelled)
    )
    await session.commit()

    # load all waiting entries with their user
    rows = (
        await session.scalars(
            select(DuelQueue)
            .where(DuelQueue.status == DuelQueueStatus.waiting, DuelQueue.expires_at > now)
            .options(selectinload(DuelQueue.user))
            .order_by(DuelQueue.joined_at)
        )
    ).all()

    # group by time control
    by_time: dict[int, list[DuelQueue]] = {}
    for entry in rows:
        by_time.setdefault(entry.time_limit_minutes, []).append(entry)

    for time_limit, group in by_time.items():
        if len(group) < 2:
            continue

        group.sort(key=lambda e: e.user.duel_rating)
        used: set[object] = set()

        for entry in group:
            if entry.id in used:
                continue

            # find closest-elo unmatched opponent
            best: DuelQueue | None = None
            best_gap = float("inf")
            for other in group:
                if other.id in used or other.id == entry.id:
                    continue
                gap = abs(entry.user.duel_rating - other.user.duel_rating)
                if gap < best_gap:
                    best_gap = gap
                    best = other

            if best is None:
                continue

            avg_elo = (entry.user.duel_rating + best.user.duel_rating) // 2
            diff_min, diff_max = _difficulty_for_elo(avg_elo)

            problem = await session.scalar(
                select(Problem)
                .where(
                    Problem.visibility == Visibility.public,
                    Problem.difficulty >= diff_min,
                    Problem.difficulty <= diff_max,
                )
                .order_by(func.random())
                .limit(1)
            )
            if problem is None:
                problem = await session.scalar(
                    select(Problem)
                    .where(Problem.visibility == Visibility.public)
                    .order_by(func.random())
                    .limit(1)
                )
            if problem is None:
                continue

            duel = Duel(
                challenger_id=entry.user_id,
                opponent_id=best.user_id,
                problem_id=problem.id,
                status=DuelStatus.active,
                started_at=now,
                time_limit_minutes=time_limit,
            )
            session.add(duel)
            await session.flush()

            entry.status = DuelQueueStatus.matched
            entry.matched_duel_id = duel.id
            best.status = DuelQueueStatus.matched
            best.matched_duel_id = duel.id

            used.add(entry.id)
            used.add(best.id)

            log.info(
                "matched %s (Elo %d) vs %s (Elo %d) → duel %s, difficulty %d-%d",
                entry.user.username,
                entry.user.duel_rating,
                best.user.username,
                best.user.duel_rating,
                duel.id,
                diff_min,
                diff_max,
            )

        await session.commit()


async def process_contest_rating_settlement(session: AsyncSession) -> None:
    """finalize contest_rating for any rated contest whose end_time has passed; idempotent via rating_finalized_at"""
    now = datetime.now(UTC)
    contests = (
        await session.scalars(
            select(Contest).where(
                Contest.is_rated.is_(True),
                Contest.end_time <= now,
                Contest.rating_finalized_at.is_(None),
            )
        )
    ).all()

    for contest in contests:
        await _settle_contest_rating(contest, session)


async def _settle_contest_rating(contest: Contest, session: AsyncSession) -> None:
    now = datetime.now(UTC)
    leaderboard = await build_leaderboard(contest.slug, session)

    if leaderboard is None or len(leaderboard.entries) < 2:
        contest.rating_finalized_at = now
        await session.commit()
        return

    user_ids = [e.user_id for e in leaderboard.entries]
    users = {
        u.id: u for u in (await session.scalars(select(User).where(User.id.in_(user_ids)))).all()
    }

    entrants = [
        RatingEntrant(user_id=e.user_id, rating=users[e.user_id].contest_rating, rank=e.rank)
        for e in leaderboard.entries
        if e.user_id in users
    ]
    deltas = compute_rating_deltas(entrants)

    for entry in leaderboard.entries:
        user = users.get(entry.user_id)
        if user is None:
            continue
        before = user.contest_rating
        after = max(0, before + deltas.get(entry.user_id, 0))
        session.add(
            ContestRatingHistory(
                user_id=user.id,
                contest_id=contest.id,
                rank=entry.rank,
                rating_before=before,
                rating_after=after,
                delta=after - before,
            )
        )
        user.contest_rating = after

    contest.rating_finalized_at = now
    await session.commit()
    log.info("settled contest rating for %s (%d entrants)", contest.slug, len(entrants))


async def run_worker() -> None:
    """poll for queued jobs forever, processing one per iteration"""
    engine = create_async_engine(
        settings.database_url,
        pool_pre_ping=True,
        connect_args={"ssl": False},
    )
    factory = async_sessionmaker(engine, expire_on_commit=False)

    log.info("worker started, polling every %.1fs", _POLL_INTERVAL)
    while True:
        try:
            async with factory() as session:
                await process_one_job(session)
            async with factory() as session:
                await process_expired_duels(session)
            async with factory() as session:
                await process_duel_queue(session)
            async with factory() as session:
                await process_contest_rating_settlement(session)
        except Exception:
            log.exception("unhandled error in worker loop")
        await asyncio.sleep(_POLL_INTERVAL)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    asyncio.run(run_worker())
