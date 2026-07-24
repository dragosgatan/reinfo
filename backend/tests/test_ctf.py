"""tests for ctf challenge endpoints: flag judging, scoring, hints, visibility"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ctf_scoring import compute_points, current_value
from app.models.ctf import CtfCategory, CtfChallenge, CtfFlagAttempt, CtfHint, CtfScoring, CtfSolve
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


async def _make_challenge(
    db: AsyncSession,
    author_id: uuid.UUID | None,
    slug: str = "warmup",
    flag: str = "reinfo{test_flag}",
    flag_case_sensitive: bool = True,
    scoring: CtfScoring = CtfScoring.static,
    base_points: int = 100,
    published: bool = True,
) -> CtfChallenge:
    from app.security import hash_flag

    challenge = CtfChallenge(
        slug=slug,
        title="Warmup",
        statement_md="Find the flag.",
        category=CtfCategory.misc,
        difficulty=2,
        base_points=base_points,
        scoring=scoring,
        flag_hash=hash_flag(flag, flag_case_sensitive),
        flag_case_sensitive=flag_case_sensitive,
        published=published,
        author_id=author_id,
    )
    db.add(challenge)
    await db.commit()
    await db.refresh(challenge)
    return challenge


class TestDynamicScoring:
    def test_static_ignores_solve_count(self) -> None:
        assert current_value(100, CtfScoring.static, 0) == 100
        assert current_value(100, CtfScoring.static, 50) == 100

    def test_dynamic_first_solve_is_full_value(self) -> None:
        assert current_value(100, CtfScoring.dynamic, 0) == 100

    def test_dynamic_decays_toward_floor(self) -> None:
        v2 = current_value(100, CtfScoring.dynamic, 2)
        v6 = current_value(100, CtfScoring.dynamic, 6)
        assert 50 < v6 < v2 < 100

    def test_dynamic_floor_after_decay_solves(self) -> None:
        assert current_value(100, CtfScoring.dynamic, 10) == 50
        assert current_value(100, CtfScoring.dynamic, 100) == 50

    def test_hint_cost_deducted_and_floored_at_zero(self) -> None:
        assert compute_points(100, CtfScoring.static, 0, hint_cost_spent=30) == 70
        assert compute_points(100, CtfScoring.static, 0, hint_cost_spent=1000) == 0


@pytest.mark.asyncio
async def test_flag_stored_only_as_hash(db_session: AsyncSession) -> None:
    author = await _make_user(db_session, "ctf-author1", UserRole.teacher)
    challenge = await _make_challenge(
        db_session, author.id, slug="hash-check", flag="reinfo{secret}"
    )
    row = await db_session.scalar(select(CtfChallenge).where(CtfChallenge.id == challenge.id))
    assert row is not None
    assert row.flag_hash != "reinfo{secret}"
    assert "secret" not in row.flag_hash


@pytest.mark.asyncio
async def test_submit_correct_flag_awards_once_idempotent(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    author = await _make_user(db_session, "ctf-author2", UserRole.teacher)
    await _make_user(db_session, "ctf-solver1")
    challenge = await _make_challenge(
        db_session, author.id, slug="idempotent", flag="reinfo{flag1}"
    )
    await _login(client, "ctf-solver1")

    r = await client.post(f"/api/ctf/{challenge.slug}/submit-flag", json={"flag": "reinfo{flag1}"})
    assert r.status_code == 200
    body = r.json()
    assert body["correct"] is True
    assert body["already_solved"] is False
    assert body["first_blood"] is True
    assert body["points_awarded"] == 100

    r2 = await client.post(f"/api/ctf/{challenge.slug}/submit-flag", json={"flag": "reinfo{flag1}"})
    body2 = r2.json()
    assert body2["already_solved"] is True
    assert body2["points_awarded"] == 100

    solves = (await db_session.execute(select(CtfSolve))).all()
    assert len(solves) == 1


@pytest.mark.asyncio
async def test_submit_wrong_flag_case_insensitive(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    author = await _make_user(db_session, "ctf-author3", UserRole.teacher)
    await _make_user(db_session, "ctf-solver2")
    challenge = await _make_challenge(
        db_session,
        author.id,
        slug="case-insensitive",
        flag="reinfo{CaseFlag}",
        flag_case_sensitive=False,
    )
    await _login(client, "ctf-solver2")

    r = await client.post(
        f"/api/ctf/{challenge.slug}/submit-flag", json={"flag": "REINFO{CASEFLAG}"}
    )
    assert r.status_code == 200
    assert r.json()["correct"] is True


@pytest.mark.asyncio
async def test_wrong_flag_recorded_and_rate_limited(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    author = await _make_user(db_session, "ctf-author4", UserRole.teacher)
    await _make_user(db_session, "ctf-solver3")
    challenge = await _make_challenge(
        db_session, author.id, slug="cooldown", flag="reinfo{correct}"
    )
    await _login(client, "ctf-solver3")

    for _ in range(4):
        r = await client.post(f"/api/ctf/{challenge.slug}/submit-flag", json={"flag": "wrong"})
        assert r.status_code == 200
        assert r.json()["correct"] is False

    attempts = (
        await db_session.execute(
            select(CtfFlagAttempt).where(CtfFlagAttempt.challenge_id == challenge.id)
        )
    ).all()
    assert len(attempts) == 4

    r5 = await client.post(f"/api/ctf/{challenge.slug}/submit-flag", json={"flag": "wrong"})
    assert r5.status_code == 429
    assert "Retry-After" in r5.headers


@pytest.mark.asyncio
async def test_first_blood_only_for_first_solver(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    author = await _make_user(db_session, "ctf-author5", UserRole.teacher)
    await _make_user(db_session, "ctf-first")
    await _make_user(db_session, "ctf-second")
    challenge = await _make_challenge(db_session, author.id, slug="blood", flag="reinfo{blood}")

    await _login(client, "ctf-first")
    r1 = await client.post(f"/api/ctf/{challenge.slug}/submit-flag", json={"flag": "reinfo{blood}"})
    assert r1.json()["first_blood"] is True

    await _login(client, "ctf-second")
    r2 = await client.post(f"/api/ctf/{challenge.slug}/submit-flag", json={"flag": "reinfo{blood}"})
    assert r2.json()["first_blood"] is False


@pytest.mark.asyncio
async def test_unpublished_challenge_hidden_from_others(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    author = await _make_user(db_session, "ctf-author6", UserRole.teacher)
    await _make_user(db_session, "ctf-outsider")
    challenge = await _make_challenge(
        db_session, author.id, slug="draft-chal", flag="reinfo{draft}", published=False
    )

    r = await client.get(f"/api/ctf/{challenge.slug}")
    assert r.status_code == 404

    await _login(client, "ctf-outsider")
    r2 = await client.get(f"/api/ctf/{challenge.slug}")
    assert r2.status_code == 404


@pytest.mark.asyncio
async def test_hint_reveal_deducts_cost_from_solve(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    author = await _make_user(db_session, "ctf-author7", UserRole.teacher)
    await _make_user(db_session, "ctf-hinter")
    challenge = await _make_challenge(
        db_session, author.id, slug="hinted", flag="reinfo{hinted}", base_points=100
    )

    hint = CtfHint(challenge_id=challenge.id, content_md="It's in the title.", cost=20, ordinal=0)
    db_session.add(hint)
    await db_session.commit()
    await db_session.refresh(hint)

    await _login(client, "ctf-hinter")
    r = await client.post(f"/api/ctf/{challenge.slug}/hints/{hint.id}/reveal")
    assert r.status_code == 200
    assert r.json()["content_md"] == "It's in the title."

    r2 = await client.post(
        f"/api/ctf/{challenge.slug}/submit-flag", json={"flag": "reinfo{hinted}"}
    )
    assert r2.json()["points_awarded"] == 80


@pytest.mark.asyncio
async def test_list_challenges_includes_first_blood(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    author = await _make_user(db_session, "ctf-author9", UserRole.teacher)
    await _make_user(db_session, "ctf-lister")
    challenge = await _make_challenge(db_session, author.id, slug="listed", flag="reinfo{listed}")

    r0 = await client.get("/api/ctf")
    item0 = next(i for i in r0.json()["items"] if i["slug"] == "listed")
    assert item0["first_blood_username"] is None

    await _login(client, "ctf-lister")
    await client.post(f"/api/ctf/{challenge.slug}/submit-flag", json={"flag": "reinfo{listed}"})

    r1 = await client.get("/api/ctf")
    item1 = next(i for i in r1.json()["items"] if i["slug"] == "listed")
    assert item1["first_blood_username"] == "ctf-lister"
    assert item1["solve_count"] == 1


@pytest.mark.asyncio
async def test_scoreboard_ranks_by_points(client: AsyncClient, db_session: AsyncSession) -> None:
    author = await _make_user(db_session, "ctf-author10", UserRole.teacher)
    chal_a = await _make_challenge(
        db_session, author.id, slug="score-a", flag="reinfo{a}", base_points=100
    )
    chal_b = await _make_challenge(
        db_session, author.id, slug="score-b", flag="reinfo{b}", base_points=50
    )

    await _make_user(db_session, "ctf-top")
    await _login(client, "ctf-top")
    await client.post(f"/api/ctf/{chal_a.slug}/submit-flag", json={"flag": "reinfo{a}"})
    await client.post(f"/api/ctf/{chal_b.slug}/submit-flag", json={"flag": "reinfo{b}"})

    await _make_user(db_session, "ctf-second")
    await _login(client, "ctf-second")
    await client.post(f"/api/ctf/{chal_a.slug}/submit-flag", json={"flag": "reinfo{a}"})

    r = await client.get("/api/ctf/scoreboard")
    assert r.status_code == 200
    entries = r.json()["entries"]
    assert entries[0]["username"] == "ctf-top"
    assert entries[0]["total_points"] == 150
    assert entries[0]["rank"] == 1
    assert entries[1]["username"] == "ctf-second"
    assert entries[1]["total_points"] == 100
    assert entries[0]["category_points"]["misc"] == 150


@pytest.mark.asyncio
async def test_dynamic_scoring_end_to_end(client: AsyncClient, db_session: AsyncSession) -> None:
    author = await _make_user(db_session, "ctf-author8", UserRole.teacher)
    challenge = await _make_challenge(
        db_session,
        author.id,
        slug="dynamic-chal",
        flag="reinfo{dyn}",
        scoring=CtfScoring.dynamic,
        base_points=100,
    )

    solver1 = await _make_user(db_session, "ctf-dyn1")
    await _login(client, "ctf-dyn1")
    r1 = await client.post(f"/api/ctf/{challenge.slug}/submit-flag", json={"flag": "reinfo{dyn}"})
    assert r1.json()["points_awarded"] == 100

    await _make_user(db_session, "ctf-dyn2")
    await _login(client, "ctf-dyn2")
    r2 = await client.post(f"/api/ctf/{challenge.slug}/submit-flag", json={"flag": "reinfo{dyn}"})
    assert r2.json()["points_awarded"] < 100

    solve1 = await db_session.scalar(
        select(CtfSolve).where(
            CtfSolve.challenge_id == challenge.id, CtfSolve.user_id == solver1.id
        )
    )
    assert solve1 is not None
    assert solve1.points_awarded == 100
