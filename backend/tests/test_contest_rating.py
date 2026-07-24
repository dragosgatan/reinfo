"""tests for the contest rating formula (app.contest_rating) and the worker's idempotent settlement job"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.contest_rating import RatingEntrant, compute_rating_deltas
from app.models.contest import (
    Contest,
    ContestParticipant,
    ContestProblem,
    ContestRatingHistory,
    ContestType,
)
from app.models.problem import ComparisonMode, Problem, TestCase, Visibility
from app.models.submission import Submission, Verdict
from app.models.user import User, UserRole
from app.security import hash_password
from app.worker import process_contest_rating_settlement

_PASSWORD = "testpassword1"


class TestComputeRatingDeltas:
    def test_no_entrants_is_a_no_op(self) -> None:
        assert compute_rating_deltas([]) == {}

    def test_single_entrant_gets_zero_delta(self) -> None:
        entrants = [RatingEntrant(user_id="a", rating=1500, rank=1)]
        assert compute_rating_deltas(entrants) == {"a": 0}

    def test_equal_ratings_winner_gains_loser_loses_symmetrically(self) -> None:
        entrants = [
            RatingEntrant(user_id="a", rating=1500, rank=1),
            RatingEntrant(user_id="b", rating=1500, rank=2),
        ]
        deltas = compute_rating_deltas(entrants)
        assert deltas["a"] > 0
        assert deltas["b"] < 0
        assert deltas["a"] == -deltas["b"]

    def test_tied_rank_is_a_draw_no_change_between_equal_rated_players(self) -> None:
        entrants = [
            RatingEntrant(user_id="a", rating=1500, rank=1),
            RatingEntrant(user_id="b", rating=1500, rank=1),
        ]
        deltas = compute_rating_deltas(entrants)
        assert deltas["a"] == 0
        assert deltas["b"] == 0

    def test_deterministic_three_player_fixture_exact_values(self) -> None:
        """hand-derived fixture (k=32, 400-point logistic scale): a=1600/rank1, b=1500/rank2, c=1400/rank3 nets +10/0/-10"""
        entrants = [
            RatingEntrant(user_id="A", rating=1600, rank=1),
            RatingEntrant(user_id="B", rating=1500, rank=2),
            RatingEntrant(user_id="C", rating=1400, rank=3),
        ]
        deltas = compute_rating_deltas(entrants)
        assert deltas == {"A": 10, "B": 0, "C": -10}

    def test_upset_gives_underdog_a_larger_gain_than_a_symmetric_win(self) -> None:
        """a big underdog (rank 1 despite a much lower rating) should gain more than in an equal-rated matchup"""
        equal = compute_rating_deltas(
            [
                RatingEntrant(user_id="a", rating=1500, rank=1),
                RatingEntrant(user_id="b", rating=1500, rank=2),
            ]
        )
        upset = compute_rating_deltas(
            [
                RatingEntrant(user_id="a", rating=1200, rank=1),
                RatingEntrant(user_id="b", rating=1800, rank=2),
            ]
        )
        assert upset["a"] > equal["a"]

    def test_field_deltas_sum_to_approximately_zero(self) -> None:
        entrants = [
            RatingEntrant(user_id=i, rating=rating, rank=rank)
            for i, (rating, rank) in enumerate(
                [(1200, 4), (1500, 1), (1350, 3), (1900, 2), (1000, 5)]
            )
        ]
        deltas = compute_rating_deltas(entrants)
        # Individual deltas are rounded independently, so the sum can be off by a
        # few integers, but never by anywhere near a full contestant's swing.
        assert abs(sum(deltas.values())) <= 2

    def test_is_deterministic_across_repeated_calls(self) -> None:
        entrants = [
            RatingEntrant(user_id="a", rating=1432, rank=2),
            RatingEntrant(user_id="b", rating=1611, rank=1),
            RatingEntrant(user_id="c", rating=1288, rank=3),
        ]
        first = compute_rating_deltas(entrants)
        second = compute_rating_deltas(entrants)
        assert first == second


async def _make_user(db: AsyncSession, username: str, contest_rating: int = 1500) -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        password_hash=hash_password(_PASSWORD),
        display_name=username,
        role=UserRole.student,
        contest_rating=contest_rating,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _make_rated_contest(db: AsyncSession, slug: str, ended_minutes_ago: int = 10) -> Contest:
    now = datetime.now(UTC)
    contest = Contest(
        slug=slug,
        title="Weekly Rated",
        start_time=now - timedelta(hours=2),
        end_time=now - timedelta(minutes=ended_minutes_ago),
        contest_type=ContestType.competition,
        is_rated=True,
    )
    db.add(contest)
    await db.commit()
    await db.refresh(contest)
    return contest


async def _make_problem(db: AsyncSession, slug: str, contest_id: uuid.UUID) -> Problem:
    p = Problem(
        slug=slug,
        title="P",
        statement_md="s",
        input_format="i",
        output_format="o",
        difficulty=1,
        visibility=Visibility.contest,
        updated_at=datetime.now(UTC),
        comparison_mode=ComparisonMode.exact,
        origin_contest_id=contest_id,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)

    from app.storage import save_test_case

    in_path, out_path = await save_test_case(p.id, 1, b"1\n", b"1\n")
    db.add(
        TestCase(problem_id=p.id, ordinal=1, input_path=in_path, output_path=out_path, score=100)
    )
    db.add(ContestProblem(contest_id=contest_id, problem_id=p.id, ordinal=1))
    await db.commit()
    return p


async def _register(db: AsyncSession, contest_id: uuid.UUID, user_id: uuid.UUID) -> None:
    db.add(ContestParticipant(contest_id=contest_id, user_id=user_id))
    await db.commit()


async def _submit(
    db: AsyncSession,
    contest_id: uuid.UUID,
    problem_id: uuid.UUID,
    user_id: uuid.UUID,
    score: int,
) -> None:
    db.add(
        Submission(
            user_id=user_id,
            problem_id=problem_id,
            contest_id=contest_id,
            submitted_code="pass",
            language="python",
            verdict=Verdict.AC if score > 0 else Verdict.WA,
            score=score,
        )
    )
    await db.commit()


@pytest.mark.asyncio
async def test_settlement_ranks_and_updates_ratings(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    winner = await _make_user(db_session, "rated-winner", contest_rating=1500)
    loser = await _make_user(db_session, "rated-loser", contest_rating=1500)
    contest = await _make_rated_contest(db_session, "weekly-1")
    problem = await _make_problem(db_session, "weekly-1-p1", contest.id)
    await _register(db_session, contest.id, winner.id)
    await _register(db_session, contest.id, loser.id)
    await _submit(db_session, contest.id, problem.id, winner.id, 100)
    await _submit(db_session, contest.id, problem.id, loser.id, 0)

    await process_contest_rating_settlement(db_session)

    await db_session.refresh(winner)
    await db_session.refresh(loser)
    assert winner.contest_rating > 1500
    assert loser.contest_rating < 1500

    history = (
        await db_session.scalars(
            select(ContestRatingHistory).where(ContestRatingHistory.contest_id == contest.id)
        )
    ).all()
    assert len(history) == 2
    by_user = {h.user_id: h for h in history}
    assert by_user[winner.id].rank == 1
    assert by_user[loser.id].rank == 2
    assert by_user[winner.id].rating_before == 1500
    assert by_user[winner.id].rating_after == winner.contest_rating
    assert by_user[winner.id].delta == winner.contest_rating - 1500

    contest_after = await db_session.get(Contest, contest.id)
    assert contest_after.rating_finalized_at is not None


@pytest.mark.asyncio
async def test_settlement_is_idempotent(client: AsyncClient, db_session: AsyncSession) -> None:
    winner = await _make_user(db_session, "idem-winner")
    loser = await _make_user(db_session, "idem-loser")
    contest = await _make_rated_contest(db_session, "weekly-2")
    problem = await _make_problem(db_session, "weekly-2-p1", contest.id)
    await _register(db_session, contest.id, winner.id)
    await _register(db_session, contest.id, loser.id)
    await _submit(db_session, contest.id, problem.id, winner.id, 100)
    await _submit(db_session, contest.id, problem.id, loser.id, 0)

    await process_contest_rating_settlement(db_session)
    await db_session.refresh(winner)
    rating_after_first_pass = winner.contest_rating

    # Simulate the worker loop ticking again after the contest is already settled.
    await process_contest_rating_settlement(db_session)
    await db_session.refresh(winner)

    assert winner.contest_rating == rating_after_first_pass
    history = (
        await db_session.scalars(
            select(ContestRatingHistory).where(ContestRatingHistory.contest_id == contest.id)
        )
    ).all()
    assert len(history) == 2


@pytest.mark.asyncio
async def test_unrated_contest_is_never_settled(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    user = await _make_user(db_session, "unrated-user")
    now = datetime.now(UTC)
    contest = Contest(
        slug="not-rated",
        title="Not rated",
        start_time=now - timedelta(hours=2),
        end_time=now - timedelta(minutes=10),
        contest_type=ContestType.competition,
        is_rated=False,
    )
    db_session.add(contest)
    await db_session.commit()
    await db_session.refresh(contest)
    await _register(db_session, contest.id, user.id)

    await process_contest_rating_settlement(db_session)

    contest_after = await db_session.get(Contest, contest.id)
    assert contest_after.rating_finalized_at is None
    await db_session.refresh(user)
    assert user.contest_rating == 1500


@pytest.mark.asyncio
async def test_ongoing_rated_contest_is_not_settled_early(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    user = await _make_user(db_session, "ongoing-user")
    now = datetime.now(UTC)
    contest = Contest(
        slug="still-running",
        title="Still running",
        start_time=now - timedelta(minutes=30),
        end_time=now + timedelta(hours=1),
        contest_type=ContestType.competition,
        is_rated=True,
    )
    db_session.add(contest)
    await db_session.commit()
    await db_session.refresh(contest)
    await _register(db_session, contest.id, user.id)

    await process_contest_rating_settlement(db_session)

    contest_after = await db_session.get(Contest, contest.id)
    assert contest_after.rating_finalized_at is None


@pytest.mark.asyncio
async def test_fewer_than_two_participants_finalizes_with_no_rating_change(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    user = await _make_user(db_session, "solo-user")
    contest = await _make_rated_contest(db_session, "weekly-solo")
    await _register(db_session, contest.id, user.id)

    await process_contest_rating_settlement(db_session)

    contest_after = await db_session.get(Contest, contest.id)
    assert contest_after.rating_finalized_at is not None
    await db_session.refresh(user)
    assert user.contest_rating == 1500

    history = (
        await db_session.scalars(
            select(ContestRatingHistory).where(ContestRatingHistory.contest_id == contest.id)
        )
    ).all()
    assert history == []


@pytest.mark.asyncio
async def test_rating_history_endpoint_returns_settled_changes(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    winner = await _make_user(db_session, "history-winner")
    loser = await _make_user(db_session, "history-loser")
    contest = await _make_rated_contest(db_session, "weekly-3")
    problem = await _make_problem(db_session, "weekly-3-p1", contest.id)
    await _register(db_session, contest.id, winner.id)
    await _register(db_session, contest.id, loser.id)
    await _submit(db_session, contest.id, problem.id, winner.id, 100)
    await _submit(db_session, contest.id, problem.id, loser.id, 0)
    await process_contest_rating_settlement(db_session)

    r = await client.get("/api/contests/users/history-winner/rating-history")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["rank"] == 1
    assert body[0]["delta"] > 0
