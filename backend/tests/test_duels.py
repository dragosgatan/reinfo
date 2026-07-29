"""tests for duel api endpoints"""

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.problem import ComparisonMode, Problem, ProblemType, Visibility
from app.models.user import User, UserRole
from app.security import hash_password

_PASSWORD = "testpassword1"


async def _make_user(db: AsyncSession, username: str, role: UserRole = UserRole.student) -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        password_hash=hash_password(_PASSWORD),
        display_name=username,
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _login(client: AsyncClient, username: str) -> None:
    r = await client.post("/api/auth/login", json={"username": username, "password": _PASSWORD})
    assert r.status_code == 200, r.text


async def _make_problem(
    db: AsyncSession,
    slug: str,
    problem_type: ProblemType = ProblemType.standard,
    difficulty: int = 3,
) -> Problem:
    p = Problem(
        slug=slug,
        title="Duel Problem",
        statement_md="Statement",
        input_format="Input",
        output_format="Output",
        difficulty=difficulty,
        visibility=Visibility.public,
        updated_at=datetime.now(UTC),
        comparison_mode=ComparisonMode.exact,
        problem_type=problem_type,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


async def _send_and_accept(
    client: AsyncClient, db: AsyncSession, challenger: User, opponent: User
) -> dict:
    await _login(client, challenger.username)
    r = await client.post(
        "/api/duels/requests",
        json={
            "to_username": opponent.username,
            "time_limit_minutes": 30,
            "difficulty_min": 1,
            "difficulty_max": 10,
        },
    )
    assert r.status_code == 201, r.text
    request_id = r.json()["id"]

    await _login(client, opponent.username)
    r = await client.post(f"/api/duels/requests/{request_id}/accept")
    assert r.status_code == 201, r.text
    return r.json()


@pytest.mark.asyncio
async def test_accept_duel_request_never_picks_quiz_problem(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """duels must only pick standard (code-judged) problems, never quiz problems"""
    challenger = await _make_user(db_session, "duel_challenger")
    opponent = await _make_user(db_session, "duel_opponent")
    await _make_problem(db_session, slug="duel-quiz-only", problem_type=ProblemType.quiz)

    await _login(client, challenger.username)
    r = await client.post(
        "/api/duels/requests",
        json={
            "to_username": opponent.username,
            "time_limit_minutes": 30,
            "difficulty_min": 1,
            "difficulty_max": 10,
        },
    )
    assert r.status_code == 201, r.text
    request_id = r.json()["id"]

    await _login(client, opponent.username)
    r = await client.post(f"/api/duels/requests/{request_id}/accept")
    assert r.status_code == 422, r.text


@pytest.mark.asyncio
async def test_accept_duel_request_picks_standard_problem(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """when a matching standard problem exists alongside a quiz one, the duel uses the standard problem"""
    challenger = await _make_user(db_session, "duel_challenger2")
    opponent = await _make_user(db_session, "duel_opponent2")
    await _make_problem(db_session, slug="duel-quiz2", problem_type=ProblemType.quiz)
    standard = await _make_problem(
        db_session, slug="duel-standard2", problem_type=ProblemType.standard
    )

    duel = await _send_and_accept(client, db_session, challenger, opponent)
    assert duel["problem_id"] == str(standard.id)
