"""tests for the ephemeral /api/problems/{slug}/run endpoint"""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.problem import ComparisonMode, Problem, TestCase, Visibility
from app.models.submission import Submission
from app.models.user import User, UserRole
from app.piston import ExecutionResult
from app.security import hash_password
from app.storage import save_test_case

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
    slug: str = "run-prob",
    visibility: Visibility = Visibility.public,
    comparison_mode: ComparisonMode = ComparisonMode.exact,
) -> Problem:
    from datetime import UTC, datetime

    p = Problem(
        slug=slug,
        title="Run Problem",
        statement_md="Statement",
        input_format="Input",
        output_format="Output",
        difficulty=3,
        author_id=author_id,
        visibility=visibility,
        updated_at=datetime.now(UTC),
        comparison_mode=comparison_mode,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


async def _make_test_case(
    db: AsyncSession,
    problem_id: uuid.UUID,
    ordinal: int,
    input_bytes: bytes = b"input\n",
    expected_output: bytes = b"42\n",
    is_sample: bool = True,
) -> TestCase:
    in_path, out_path = await save_test_case(problem_id, ordinal, input_bytes, expected_output)
    tc = TestCase(
        problem_id=problem_id,
        ordinal=ordinal,
        input_path=in_path,
        output_path=out_path,
        score=10,
        is_sample=is_sample,
        is_hidden=not is_sample,
    )
    db.add(tc)
    await db.commit()
    await db.refresh(tc)
    return tc


def _run_result(
    stdout: str = "42\n", exit_code: int = 0, compile_error: bool = False, timed_out: bool = False
) -> ExecutionResult:
    return ExecutionResult(
        stdout=stdout,
        stderr="",
        exit_code=exit_code,
        compile_error=compile_error,
        time_ms=50,
        memory_kb=1024,
        timed_out=timed_out,
    )


def _mock_piston(*results: ExecutionResult):
    return patch(
        "app.routers.problems.piston_client.execute",
        new_callable=AsyncMock,
        side_effect=list(results) if len(results) > 1 else None,
        return_value=results[0] if len(results) == 1 else None,
    )


@pytest.mark.asyncio
async def test_run_samples_all_pass(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "runner1")
    problem = await _make_problem(db_session, user.id, slug="run-all-pass")
    await _make_test_case(db_session, problem.id, 1, expected_output=b"42\n")
    await _make_test_case(db_session, problem.id, 2, expected_output=b"42\n")
    await _login(client, "runner1")

    with _mock_piston(_run_result("42\n"), _run_result("42\n")):
        r = await client.post(
            f"/api/problems/{problem.slug}/run",
            json={"source_code": "print(42)", "language": "python"},
        )

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mode"] == "samples"
    assert body["compile_error"] is False
    assert len(body["samples"]) == 2
    assert all(s["passed"] for s in body["samples"])


@pytest.mark.asyncio
async def test_run_samples_mixed_results(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "runner2")
    problem = await _make_problem(db_session, user.id, slug="run-mixed")
    await _make_test_case(db_session, problem.id, 1, expected_output=b"42\n")
    await _make_test_case(db_session, problem.id, 2, expected_output=b"99\n")
    await _login(client, "runner2")

    with _mock_piston(_run_result("42\n"), _run_result("wrong\n")):
        r = await client.post(
            f"/api/problems/{problem.slug}/run",
            json={"source_code": "print(42)", "language": "python"},
        )

    assert r.status_code == 200
    samples = r.json()["samples"]
    assert samples[0]["passed"] is True
    assert samples[1]["passed"] is False
    assert samples[1]["expected_output"] == "99\n"


@pytest.mark.asyncio
async def test_run_compile_error_stops_remaining_samples(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    user = await _make_user(db_session, "runner3")
    problem = await _make_problem(db_session, user.id, slug="run-ce")
    await _make_test_case(db_session, problem.id, 1)
    await _make_test_case(db_session, problem.id, 2)
    await _login(client, "runner3")

    ce_result = _run_result(compile_error=True)
    with patch(
        "app.routers.problems.piston_client.execute", new_callable=AsyncMock, return_value=ce_result
    ) as mock_exec:
        r = await client.post(
            f"/api/problems/{problem.slug}/run",
            json={"source_code": "bad code", "language": "cpp"},
        )

    assert r.status_code == 200
    body = r.json()
    assert body["compile_error"] is True
    assert len(body["samples"]) == 1
    assert mock_exec.call_count == 1


@pytest.mark.asyncio
async def test_run_custom_stdin(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "runner4")
    problem = await _make_problem(db_session, user.id, slug="run-custom")
    await _make_test_case(db_session, problem.id, 1)
    await _login(client, "runner4")

    with _mock_piston(_run_result("hello\n")):
        r = await client.post(
            f"/api/problems/{problem.slug}/run",
            json={"source_code": "print('hello')", "language": "python", "stdin": "abc\n"},
        )

    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "custom"
    assert body["custom"]["stdout"] == "hello\n"
    assert body["samples"] == []


@pytest.mark.asyncio
async def test_run_nothing_persisted(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "runner5")
    problem = await _make_problem(db_session, user.id, slug="run-no-persist")
    await _make_test_case(db_session, problem.id, 1)
    await _login(client, "runner5")

    with _mock_piston(_run_result("42\n")):
        r = await client.post(
            f"/api/problems/{problem.slug}/run",
            json={"source_code": "print(42)", "language": "python"},
        )

    assert r.status_code == 200
    count = await db_session.scalar(select(func.count()).select_from(Submission))
    assert count == 0


@pytest.mark.asyncio
async def test_run_invalid_language(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "runner6")
    problem = await _make_problem(db_session, user.id, slug="run-bad-lang")
    await _login(client, "runner6")

    r = await client.post(
        f"/api/problems/{problem.slug}/run",
        json={"source_code": "print(1)", "language": "brainfuck"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_run_private_problem_forbidden(client: AsyncClient, db_session: AsyncSession) -> None:
    author = await _make_user(db_session, "runner7", role=UserRole.teacher)
    other = await _make_user(db_session, "runner8")
    problem = await _make_problem(
        db_session, author.id, slug="run-private", visibility=Visibility.private
    )
    await _login(client, "runner8")

    r = await client.post(
        f"/api/problems/{problem.slug}/run",
        json={"source_code": "print(1)", "language": "python"},
    )
    assert r.status_code == 403
    assert other.id != author.id


@pytest.mark.asyncio
async def test_run_requires_login(client: AsyncClient, db_session: AsyncSession) -> None:
    problem = await _make_problem(db_session, None, slug="run-anon")

    r = await client.post(
        f"/api/problems/{problem.slug}/run",
        json={"source_code": "print(1)", "language": "python"},
    )
    assert r.status_code == 401
