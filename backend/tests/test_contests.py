"""tests for contest api endpoints"""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contest import Contest, ContestProblem, ScoringMode
from app.models.problem import ComparisonMode, Problem, Visibility
from app.models.user import User, UserRole
from app.piston import ExecutionResult
from app.realtime import hub
from app.security import hash_password
from app.storage import save_test_case
from app.worker import process_one_job

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
    author_id: uuid.UUID | None = None,
    slug: str = "contest-prob",
    visibility: Visibility = Visibility.public,
) -> Problem:
    p = Problem(
        slug=slug,
        title="Contest Problem",
        statement_md="Statement",
        input_format="Input",
        output_format="Output",
        difficulty=3,
        author_id=author_id,
        visibility=visibility,
        updated_at=datetime.now(UTC),
        comparison_mode=ComparisonMode.exact,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


async def _make_test_case(
    db: AsyncSession,
    problem_id: uuid.UUID,
    ordinal: int = 1,
    expected_output: bytes = b"42\n",
    score: int = 10,
) -> None:
    in_path, out_path = await save_test_case(problem_id, ordinal, b"input\n", expected_output)
    from app.models.problem import TestCase

    tc = TestCase(
        problem_id=problem_id,
        ordinal=ordinal,
        input_path=in_path,
        output_path=out_path,
        score=score,
        is_sample=False,
        is_hidden=True,
    )
    db.add(tc)
    await db.commit()


async def _make_contest(
    db: AsyncSession,
    creator_id: uuid.UUID,
    slug: str = "test-contest",
    start_offset_minutes: int = -10,
    end_offset_minutes: int = 60,
    scoring_mode: ScoringMode = ScoringMode.sum,
) -> Contest:
    now = datetime.now(UTC)
    contest = Contest(
        slug=slug,
        scoring_mode=scoring_mode,
        title="Test Contest",
        start_time=now + timedelta(minutes=start_offset_minutes),
        end_time=now + timedelta(minutes=end_offset_minutes),
        created_by=creator_id,
    )
    db.add(contest)
    await db.commit()
    await db.refresh(contest)
    return contest


async def _register(client: AsyncClient, contest_slug: str) -> None:
    r = await client.post(f"/api/contests/{contest_slug}/register")
    assert r.status_code == 201, r.text


def _mock_piston(stdout: str = "42\n"):
    result = ExecutionResult(
        stdout=stdout,
        stderr="",
        exit_code=0,
        compile_error=False,
        time_ms=50,
        memory_kb=1024,
        timed_out=False,
    )
    return patch("app.judging.piston_client.execute", new_callable=AsyncMock, return_value=result)


async def _judge(db: AsyncSession, piston_stdout: str = "42\n") -> None:
    with _mock_piston(stdout=piston_stdout):
        await process_one_job(db)


@pytest.mark.asyncio
async def test_create_contest_requires_teacher(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "student1")
    await _login(client, "student1")

    r = await client.post(
        "/api/contests",
        json={
            "title": "My Contest",
            "start_time": "2030-01-01T10:00:00Z",
            "end_time": "2030-01-01T12:00:00Z",
        },
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_create_contest_teacher(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "teacher1", UserRole.teacher)
    await _login(client, "teacher1")

    r = await client.post(
        "/api/contests",
        json={
            "title": "Olimpiadă Locală",
            "start_time": "2030-01-01T10:00:00Z",
            "end_time": "2030-01-01T12:00:00Z",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["slug"] == "olimpiada-locala"
    assert body["status"] == "upcoming"
    assert body["problem_count"] == 0
    assert body["participant_count"] == 0


@pytest.mark.asyncio
async def test_slug_uniqueness(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "teacher2", UserRole.teacher)
    await _login(client, "teacher2")

    payload = {
        "title": "Duel",
        "start_time": "2030-01-01T10:00:00Z",
        "end_time": "2030-01-01T12:00:00Z",
    }
    r1 = await client.post("/api/contests", json=payload)
    r2 = await client.post("/api/contests", json=payload)
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["slug"] != r2.json()["slug"]


@pytest.mark.asyncio
async def test_register_and_double_register(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "teacher3", UserRole.teacher)
    await _make_user(db_session, "student2")
    contest = await _make_contest(db_session, teacher.id, slug="reg-contest")

    await _login(client, "student2")
    r1 = await client.post(f"/api/contests/{contest.slug}/register")
    assert r1.status_code == 201

    r2 = await client.post(f"/api/contests/{contest.slug}/register")
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_register_past_contest_fails(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "teacher4", UserRole.teacher)
    await _make_user(db_session, "student3")
    contest = await _make_contest(
        db_session,
        teacher.id,
        slug="past-contest",
        start_offset_minutes=-120,
        end_offset_minutes=-60,
    )

    await _login(client, "student3")
    r = await client.post(f"/api/contests/{contest.slug}/register")
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_add_problem_to_contest(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "teacher5", UserRole.teacher)
    contest = await _make_contest(db_session, teacher.id, slug="prob-contest")
    await _make_problem(db_session, teacher.id, slug="prob-a")

    await _login(client, "teacher5")
    r = await client.post(f"/api/contests/{contest.slug}/problems?problem_slug=prob-a")
    assert r.status_code == 201

    detail = await client.get(f"/api/contests/{contest.slug}")
    assert detail.status_code == 200
    assert len(detail.json()["problems"]) == 1
    assert detail.json()["problems"][0]["problem_slug"] == "prob-a"
    assert detail.json()["problems"][0]["ordinal"] == 1

    # problem should now be visibility=contest
    from sqlalchemy import select

    from app.models.problem import Problem

    p = await db_session.scalar(select(Problem).where(Problem.slug == "prob-a"))
    assert p is not None
    assert p.visibility == Visibility.contest
    assert p.origin_contest_id == contest.id


@pytest.mark.asyncio
async def test_contest_problem_hidden_before_start(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    teacher = await _make_user(db_session, "teacher6", UserRole.teacher)
    await _make_user(db_session, "student4")
    now = datetime.now(UTC)
    contest = Contest(
        slug="upcoming-c",
        title="Upcoming",
        start_time=now + timedelta(hours=1),
        end_time=now + timedelta(hours=3),
        created_by=teacher.id,
    )
    db_session.add(contest)
    await db_session.commit()
    await db_session.refresh(contest)

    problem = await _make_problem(
        db_session, teacher.id, slug="hidden-prob", visibility=Visibility.contest
    )
    problem.origin_contest_id = contest.id
    db_session.add(ContestProblem(contest_id=contest.id, problem_id=problem.id, ordinal=1))
    await db_session.commit()

    await _login(client, "student4")
    detail = await client.get(f"/api/contests/{contest.slug}")
    assert detail.status_code == 200
    assert detail.json()["problems"] == []


@pytest.mark.asyncio
async def test_contest_submit_and_leaderboard(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    teacher = await _make_user(db_session, "teacher7", UserRole.teacher)
    await _make_user(db_session, "student5")

    contest = await _make_contest(db_session, teacher.id, slug="sub-contest")
    problem = await _make_problem(
        db_session, teacher.id, slug="sub-prob", visibility=Visibility.contest
    )
    problem.origin_contest_id = contest.id
    db_session.add(ContestProblem(contest_id=contest.id, problem_id=problem.id, ordinal=1))
    await db_session.commit()
    await _make_test_case(db_session, problem.id, score=50)

    await _login(client, "student5")
    await _register(client, "sub-contest")

    r = await client.post(
        "/api/contests/sub-contest/problems/sub-prob/submit",
        data={"source_code": "print(42)", "language": "python"},
    )
    assert r.status_code == 201
    sub_id = r.json()["id"]

    await _judge(db_session)

    sub_detail = await client.get(f"/api/submissions/{sub_id}")
    assert sub_detail.status_code == 200
    assert sub_detail.json()["score"] == 50

    lb = await client.get("/api/contests/sub-contest/leaderboard")
    assert lb.status_code == 200
    entries = lb.json()["entries"]
    assert len(entries) == 1
    assert entries[0]["username"] == "student5"
    assert entries[0]["total_score"] == 50
    assert entries[0]["rank"] == 1


@pytest.mark.asyncio
async def test_submit_not_participant(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "teacher8", UserRole.teacher)
    await _make_user(db_session, "student6")

    contest = await _make_contest(db_session, teacher.id, slug="np-contest")
    problem = await _make_problem(
        db_session, teacher.id, slug="np-prob", visibility=Visibility.contest
    )
    problem.origin_contest_id = contest.id
    db_session.add(ContestProblem(contest_id=contest.id, problem_id=problem.id, ordinal=1))
    await db_session.commit()

    await _login(client, "student6")
    r = await client.post(
        "/api/contests/np-contest/problems/np-prob/submit",
        data={"source_code": "print(42)", "language": "python"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_submission_isolation(client: AsyncClient, db_session: AsyncSession) -> None:
    """contest submissions are hidden from public profile until contest ends"""
    teacher = await _make_user(db_session, "teacher9", UserRole.teacher)
    await _make_user(db_session, "student7")

    contest = await _make_contest(db_session, teacher.id, slug="iso-contest")
    problem = await _make_problem(
        db_session, teacher.id, slug="iso-prob", visibility=Visibility.contest
    )
    problem.origin_contest_id = contest.id
    db_session.add(ContestProblem(contest_id=contest.id, problem_id=problem.id, ordinal=1))
    await db_session.commit()
    await _make_test_case(db_session, problem.id, score=10)

    await _login(client, "student7")
    await _register(client, "iso-contest")

    r = await client.post(
        "/api/contests/iso-contest/problems/iso-prob/submit",
        data={"source_code": "print(42)", "language": "python"},
    )
    assert r.status_code == 201

    # during the contest, submission should NOT appear in public profile history
    profile_r = await client.get("/api/users/student7/submissions")
    assert profile_r.status_code == 200
    assert profile_r.json()["total"] == 0

    # simulate contest end by mutating end_time to the past
    from sqlalchemy import select

    c = await db_session.scalar(select(Contest).where(Contest.slug == "iso-contest"))
    c.end_time = datetime.now(UTC) - timedelta(minutes=1)
    await db_session.commit()

    # now the submission should appear
    profile_r2 = await client.get("/api/users/student7/submissions")
    assert profile_r2.status_code == 200
    assert profile_r2.json()["total"] == 1


@pytest.mark.asyncio
async def test_contest_problem_public_after_end(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """contest problems appear in /api/problems after contest ends"""
    teacher = await _make_user(db_session, "teacher10", UserRole.teacher)

    now = datetime.now(UTC)
    contest = Contest(
        slug="ended-c",
        title="Ended",
        start_time=now - timedelta(hours=2),
        end_time=now - timedelta(minutes=1),
        created_by=teacher.id,
    )
    db_session.add(contest)
    await db_session.commit()
    await db_session.refresh(contest)

    problem = await _make_problem(
        db_session, teacher.id, slug="post-prob", visibility=Visibility.contest
    )
    problem.origin_contest_id = contest.id
    db_session.add(ContestProblem(contest_id=contest.id, problem_id=problem.id, ordinal=1))
    await db_session.commit()

    # unauthenticated - should see the problem now that contest is over
    r = await client.get("/api/problems")
    assert r.status_code == 200
    slugs = [item["slug"] for item in r.json()["items"]]
    assert "post-prob" in slugs


@pytest.mark.asyncio
async def test_leaderboard_ranking(client: AsyncClient, db_session: AsyncSession) -> None:
    """leaderboard ranks by total_score desc; tiebreaker is last submission time asc"""
    teacher = await _make_user(db_session, "teacher11", UserRole.teacher)
    await _make_user(db_session, "ranker1")
    await _make_user(db_session, "ranker2")

    contest = await _make_contest(db_session, teacher.id, slug="rank-contest")
    prob1 = await _make_problem(
        db_session, teacher.id, slug="rank-p1", visibility=Visibility.contest
    )
    prob1.origin_contest_id = contest.id
    prob2 = await _make_problem(
        db_session, teacher.id, slug="rank-p2", visibility=Visibility.contest
    )
    prob2.origin_contest_id = contest.id
    db_session.add(ContestProblem(contest_id=contest.id, problem_id=prob1.id, ordinal=1))
    db_session.add(ContestProblem(contest_id=contest.id, problem_id=prob2.id, ordinal=2))
    await db_session.commit()
    await _make_test_case(db_session, prob1.id, score=50)
    await _make_test_case(db_session, prob2.id, score=100)

    await _login(client, "ranker1")
    await _register(client, "rank-contest")
    # ranker1 solves both
    await client.post(
        "/api/contests/rank-contest/problems/rank-p1/submit",
        data={"source_code": "print(42)", "language": "python"},
    )
    await client.post(
        "/api/contests/rank-contest/problems/rank-p2/submit",
        data={"source_code": "print(42)", "language": "python"},
    )

    await _login(client, "ranker2")
    await _register(client, "rank-contest")
    # ranker2 solves only prob2
    await client.post(
        "/api/contests/rank-contest/problems/rank-p2/submit",
        data={"source_code": "print(42)", "language": "python"},
    )

    with _mock_piston():
        await process_one_job(db_session)
        await process_one_job(db_session)
        await process_one_job(db_session)

    lb = await client.get("/api/contests/rank-contest/leaderboard")
    assert lb.status_code == 200
    entries = lb.json()["entries"]
    assert len(entries) == 2
    assert entries[0]["username"] == "ranker1"
    assert entries[0]["total_score"] == 150
    assert entries[0]["rank"] == 1
    assert entries[1]["username"] == "ranker2"
    assert entries[1]["total_score"] == 100
    assert entries[1]["rank"] == 2


@pytest.mark.asyncio
async def test_test_mode_leaderboard_hidden_from_students(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """for test-type contests, the leaderboard is 403 for non-staff during the contest"""
    teacher = await _make_user(db_session, "teacher_test1", UserRole.teacher)
    await _make_user(db_session, "student_test1")
    await _make_contest(db_session, teacher.id, slug="frozen-c", scoring_mode=ScoringMode.test)

    await _login(client, "student_test1")
    r = await client.get("/api/contests/frozen-c/leaderboard")
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_test_mode_leaderboard_visible_to_staff(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """staff can always see the leaderboard, even during a test-type contest"""
    teacher = await _make_user(db_session, "teacher_test2", UserRole.teacher)
    await _make_contest(db_session, teacher.id, slug="staff-c", scoring_mode=ScoringMode.test)

    await _login(client, "teacher_test2")
    r = await client.get("/api/contests/staff-c/leaderboard")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_test_mode_leaderboard_visible_after_end(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """once the contest has ended, the freeze lifts for everyone"""
    teacher = await _make_user(db_session, "teacher_test3", UserRole.teacher)
    await _make_user(db_session, "student_test3")
    await _make_contest(
        db_session,
        teacher.id,
        slug="ended-test-c",
        scoring_mode=ScoringMode.test,
        start_offset_minutes=-120,
        end_offset_minutes=-30,
    )

    await _login(client, "student_test3")
    r = await client.get("/api/contests/ended-test-c/leaderboard")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_hub_broadcasts_to_subscribed_sockets_only() -> None:
    """the hub fans payloads to all sockets subscribed to a slug, and only those"""
    received_a: list[dict] = []
    received_b: list[dict] = []
    received_other: list[dict] = []

    class FakeSocket:
        def __init__(self, sink: list[dict]) -> None:
            self.sink = sink

        async def send_json(self, payload: dict) -> None:
            self.sink.append(payload)

    a = FakeSocket(received_a)
    b = FakeSocket(received_b)
    other = FakeSocket(received_other)

    await hub.connect("alpha", a)  # type: ignore[arg-type]
    await hub.connect("alpha", b)  # type: ignore[arg-type]
    await hub.connect("beta", other)  # type: ignore[arg-type]
    try:
        await hub.broadcast("alpha", {"type": "snapshot", "data": {"v": 1}})
    finally:
        await hub.disconnect("alpha", a)  # type: ignore[arg-type]
        await hub.disconnect("alpha", b)  # type: ignore[arg-type]
        await hub.disconnect("beta", other)  # type: ignore[arg-type]

    assert received_a == [{"type": "snapshot", "data": {"v": 1}}]
    assert received_b == [{"type": "snapshot", "data": {"v": 1}}]
    assert received_other == []


@pytest.mark.asyncio
async def test_hub_evicts_failed_sockets() -> None:
    """sockets that raise on send are dropped so the next broadcast skips them"""
    delivered: list[int] = []

    class FlakySocket:
        def __init__(self) -> None:
            self.calls = 0

        async def send_json(self, _payload: dict) -> None:
            self.calls += 1
            raise RuntimeError("dead socket")

    class HealthySocket:
        async def send_json(self, _payload: dict) -> None:
            delivered.append(1)

    flaky = FlakySocket()
    healthy = HealthySocket()
    await hub.connect("evict-slug", flaky)  # type: ignore[arg-type]
    await hub.connect("evict-slug", healthy)  # type: ignore[arg-type]
    try:
        await hub.broadcast("evict-slug", {"v": 1})
        await hub.broadcast("evict-slug", {"v": 2})
    finally:
        await hub.disconnect("evict-slug", healthy)  # type: ignore[arg-type]

    # flaky was called once, then evicted; healthy got both
    assert flaky.calls == 1
    assert delivered == [1, 1]
