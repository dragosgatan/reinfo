"""Contest leaderboard computation, shared by the API router and the worker's
rated-contest settlement job (app.worker) so both use the exact same ranking."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.contest import Contest, ContestParticipant, ContestProblem
from app.models.submission import Submission
from app.schemas.contest import LeaderboardEntry, LeaderboardResponse


async def build_leaderboard(slug: str, session: AsyncSession) -> LeaderboardResponse | None:
    """Compute the full leaderboard for `slug`. Returns None if the contest is missing."""
    contest = await session.scalar(
        select(Contest)
        .where(Contest.slug == slug)
        .options(
            selectinload(Contest.contest_problems).selectinload(ContestProblem.problem),
            selectinload(Contest.participants).selectinload(ContestParticipant.user),
        )
    )
    if contest is None:
        return None

    problem_slugs = [cp.problem.slug for cp in contest.contest_problems]
    problem_id_to_slug = {cp.problem_id: cp.problem.slug for cp in contest.contest_problems}
    participant_ids = [p.user_id for p in contest.participants]

    if not participant_ids or not problem_slugs:
        return LeaderboardResponse(
            contest_slug=slug,
            entries=[],
            generated_at=datetime.now(UTC),
        )

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

    entries: list[LeaderboardEntry] = []
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

    return LeaderboardResponse(
        contest_slug=slug,
        entries=entries,
        generated_at=datetime.now(UTC),
    )
