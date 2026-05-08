"""Tests for the background worker and SSE streaming endpoint."""

import asyncio
import json
import uuid
from io import BytesIO

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.judging_job import JobStatus, JudgingJob
from app.models.problem import ComparisonMode, Problem, Visibility
from app.models.submission import Submission, Verdict
from app.models.user import User, UserRole
from app.security import hash_password
from app.storage import save_submission_output, save_test_case
from app.worker import process_one_job

_PASSWORD = "testpass1"


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
    assert r.status_code == 200


async def _make_problem_with_tc(
    db: AsyncSession,
    author_id: uuid.UUID,
    slug: str,
    expected_output: bytes = b"42\n",
) -> Problem:
    from datetime import UTC, datetime

    p = Problem(
        slug=slug,
        title="Worker Test Problem",
        statement_md="Statement",
        input_format="Input",
        output_format="Output",
        difficulty=1,
        author_id=author_id,
        visibility=Visibility.public,
        updated_at=datetime.now(UTC),
        comparison_mode=ComparisonMode.exact,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)

    from app.models.problem import TestCase

    in_path, out_path = await save_test_case(p.id, 1, b"input\n", expected_output)
    tc = TestCase(
        problem_id=p.id,
        ordinal=1,
        input_path=in_path,
        output_path=out_path,
        score=10,
        is_sample=False,
        is_hidden=True,
    )
    db.add(tc)
    await db.commit()
    return p


async def _enqueue_submission(
    db: AsyncSession,
    user_id: uuid.UUID,
    problem_id: uuid.UUID,
    output: bytes,
) -> tuple[uuid.UUID, uuid.UUID]:
    """Insert a submission + judging_job directly, bypassing the HTTP layer."""
    sub_id = uuid.uuid4()
    path = await save_submission_output(user_id, sub_id, output)

    sub = Submission(
        id=sub_id,
        user_id=user_id,
        problem_id=problem_id,
        submitted_output_path=path,
        verdict=Verdict.pending,
        score=0,
    )
    job = JudgingJob(submission_id=sub_id)
    db.add(sub)
    db.add(job)
    await db.commit()

    job_row = await db.scalar(select(JudgingJob).where(JudgingJob.submission_id == sub_id))
    assert job_row is not None
    return sub_id, job_row.id


@pytest.mark.asyncio
async def test_process_one_job_ac(db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "worker-ac")
    problem = await _make_problem_with_tc(db_session, user.id, "worker-ac-prob")
    sub_id, _ = await _enqueue_submission(db_session, user.id, problem.id, b"42\n")

    processed = await process_one_job(db_session)
    assert processed is True

    sub = await db_session.get(Submission, sub_id)
    assert sub is not None
    assert sub.verdict == Verdict.AC
    assert sub.score == 10
    assert sub.judged_at is not None

    job = await db_session.scalar(select(JudgingJob).where(JudgingJob.submission_id == sub_id))
    assert job is not None
    assert job.status == JobStatus.done
    assert job.finished_at is not None
    assert job.attempts == 1


@pytest.mark.asyncio
async def test_process_one_job_wa(db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "worker-wa")
    problem = await _make_problem_with_tc(db_session, user.id, "worker-wa-prob")
    sub_id, _ = await _enqueue_submission(db_session, user.id, problem.id, b"wrong\n")

    await process_one_job(db_session)

    sub = await db_session.get(Submission, sub_id)
    assert sub is not None
    assert sub.verdict == Verdict.WA


@pytest.mark.asyncio
async def test_process_one_job_returns_false_when_empty(db_session: AsyncSession) -> None:
    processed = await process_one_job(db_session)
    assert processed is False


@pytest.mark.asyncio
async def test_no_double_processing(db_session: AsyncSession) -> None:
    """Two concurrent workers must not process the same job twice."""
    user = await _make_user(db_session, "worker-concurrent")
    problem = await _make_problem_with_tc(db_session, user.id, "worker-concurrent-prob")
    sub_id, _ = await _enqueue_submission(db_session, user.id, problem.id, b"42\n")

    from tests.conftest import _session_factory

    async with _session_factory() as session_a, _session_factory() as session_b:
        results = await asyncio.gather(
            process_one_job(session_a),
            process_one_job(session_b),
        )

    assert results.count(True) == 1
    assert results.count(False) == 1

    job = await db_session.scalar(select(JudgingJob).where(JudgingJob.submission_id == sub_id))
    assert job is not None
    assert job.status == JobStatus.done
    assert job.attempts == 1


@pytest.mark.asyncio
async def test_sse_delivers_updates(client: AsyncClient, db_session: AsyncSession) -> None:
    """SSE stream emits a done event and closes when the job is complete."""
    user = await _make_user(db_session, "sse-user")
    problem = await _make_problem_with_tc(db_session, user.id, "sse-prob")
    await _login(client, "sse-user")

    r = await client.post(
        f"/api/problems/{problem.slug}/submit",
        files={"output_file": ("a.out", BytesIO(b"42\n"), "text/plain")},
    )
    assert r.status_code == 201
    sub_id = r.json()["id"]

    # judge before connecting; the generator terminates on the first poll
    await process_one_job(db_session)

    r2 = await client.get(f"/api/submissions/{sub_id}/stream")
    assert r2.status_code == 200

    events = [json.loads(line[6:]) for line in r2.text.splitlines() if line.startswith("data: ")]
    assert len(events) >= 1
    final = events[-1]
    assert final["submission_id"] == sub_id
    assert final["verdict"] == "AC"
    assert final["job_status"] == "done"


@pytest.mark.asyncio
async def test_sse_queued_then_done(client: AsyncClient, db_session: AsyncSession) -> None:
    """SSE emits a queued event on the first poll and a done event after judging."""
    user = await _make_user(db_session, "sse-seq")
    problem = await _make_problem_with_tc(db_session, user.id, "sse-seq-prob")
    await _login(client, "sse-seq")

    r = await client.post(
        f"/api/problems/{problem.slug}/submit",
        files={"output_file": ("a.out", BytesIO(b"42\n"), "text/plain")},
    )
    sub_id = r.json()["id"]

    # schedule worker to run after the first SSE poll (poll interval = 0.5s)
    async def delayed_judge() -> None:
        await asyncio.sleep(0.6)
        await process_one_job(db_session)

    judge_task = asyncio.ensure_future(delayed_judge())

    # client.get drives the ASGI app synchronously; asyncio.sleep inside the SSE generator
    # yields to the event loop so judge_task can execute between polls
    r2 = await client.get(f"/api/submissions/{sub_id}/stream")
    await judge_task

    events = [json.loads(line[6:]) for line in r2.text.splitlines() if line.startswith("data: ")]
    statuses = [e["job_status"] for e in events]
    assert "queued" in statuses
    assert statuses[-1] == "done"


@pytest.mark.asyncio
async def test_sse_requires_auth(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "sse-noauth")
    problem = await _make_problem_with_tc(db_session, user.id, "sse-noauth-prob")
    await _login(client, "sse-noauth")

    r = await client.post(
        f"/api/problems/{problem.slug}/submit",
        files={"output_file": ("a.out", BytesIO(b"42\n"), "text/plain")},
    )
    sub_id = r.json()["id"]
    client.cookies.clear()

    r2 = await client.get(f"/api/submissions/{sub_id}/stream")
    assert r2.status_code == 403


@pytest.mark.asyncio
async def test_sse_not_found(client: AsyncClient, db_session: AsyncSession) -> None:
    r = await client.get(f"/api/submissions/{uuid.uuid4()}/stream")
    assert r.status_code == 404
