"""Unit + integration tests for the judging engine."""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.judging import (
    _compare_exact,
    _compare_float_epsilon,
    _compare_whitespace_insensitive,
    judge_submission,
)
from app.models.problem import ComparisonMode, Problem, TestCase, Visibility
from app.models.submission import Submission, SubmissionResult, Verdict
from app.models.user import User
from app.piston import ExecutionResult
from app.security import hash_password
from app.storage import save_test_case


class TestCompareExact:
    def test_equal(self):
        ok, msg = _compare_exact(b"hello\n", b"hello\n")
        assert ok and msg is None

    def test_different(self):
        ok, _ = _compare_exact(b"hello\n", b"world\n")
        assert not ok

    def test_extra_trailing_newline(self):
        ok, _ = _compare_exact(b"hello\n", b"hello\n\n")
        assert ok

    def test_trailing_space_matters(self):
        ok, _ = _compare_exact(b"hello \n", b"hello\n")
        assert not ok

    def test_empty_bytes_equal(self):
        ok, _ = _compare_exact(b"", b"")
        assert ok


class TestCompareWhitespaceInsensitive:
    def test_equal(self):
        ok, _ = _compare_whitespace_insensitive(b"hello\n", b"hello\n")
        assert ok

    def test_trailing_space_stripped(self):
        ok, _ = _compare_whitespace_insensitive(b"hello  \n", b"hello\n")
        assert ok

    def test_leading_space_stripped(self):
        ok, _ = _compare_whitespace_insensitive(b"  hello\n", b"hello\n")
        assert ok

    def test_trailing_newlines_ignored(self):
        ok, _ = _compare_whitespace_insensitive(b"hello\n\n\n", b"hello\n")
        assert ok

    def test_windows_line_endings(self):
        ok, _ = _compare_whitespace_insensitive(b"hello\r\n", b"hello\n")
        assert ok

    def test_blank_line_in_middle_preserved(self):
        ok, _ = _compare_whitespace_insensitive(b"a\n\nb\n", b"a\nb\n")
        assert not ok

    def test_different_content(self):
        ok, _ = _compare_whitespace_insensitive(b"hello\n", b"world\n")
        assert not ok

    def test_different_line_count(self):
        ok, _ = _compare_whitespace_insensitive(b"a\nb\n", b"a\n")
        assert not ok


class TestCompareFloatEpsilon:
    def test_exact_equal(self):
        ok, _ = _compare_float_epsilon(b"1.0 2.0", b"1.0 2.0", 1e-9)
        assert ok

    def test_within_tolerance(self):
        ok, _ = _compare_float_epsilon(b"1.0", b"1.0000000001", 1e-6)
        assert ok

    def test_outside_tolerance(self):
        ok, _ = _compare_float_epsilon(b"1.0", b"1.01", 1e-9)
        assert not ok

    def test_different_count(self):
        ok, msg = _compare_float_epsilon(b"1.0 2.0", b"1.0", 1e-9)
        assert not ok
        assert msg is not None

    def test_parse_error_expected(self):
        ok, msg = _compare_float_epsilon(b"hello", b"1.0", 1e-9)
        assert not ok
        assert msg is not None

    def test_parse_error_actual(self):
        ok, msg = _compare_float_epsilon(b"1.0", b"world", 1e-9)
        assert not ok
        assert msg is not None

    def test_near_zero_absolute_tolerance(self):
        # |0 - 1e-10| <= 1e-6 * max(1, 0) = 1e-6
        ok, _ = _compare_float_epsilon(b"0.0", b"0.0000000001", 1e-6)
        assert ok

    def test_large_values_relative_tolerance(self):
        # |1e6 - (1e6 + 0.5)| = 0.5 <= 1e-6 * 1e6 = 1.0
        ok, _ = _compare_float_epsilon(b"1000000.0", b"1000000.5", 1e-6)
        assert ok

    def test_multiline_floats(self):
        ok, _ = _compare_float_epsilon(b"1.0\n2.0\n3.0\n", b"1.0\n2.0\n3.0\n", 1e-9)
        assert ok

    def test_empty_both(self):
        ok, _ = _compare_float_epsilon(b"", b"", 1e-9)
        assert ok


async def _make_user(db: AsyncSession) -> User:
    user = User(
        username="judgetest",
        email="judgetest@example.com",
        password_hash=hash_password("pass"),
        display_name="Judge Test",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _make_problem(
    db: AsyncSession,
    author_id: uuid.UUID,
    *,
    comparison_mode: ComparisonMode = ComparisonMode.exact,
    float_epsilon: float | None = None,
    slug: str = "judge-prob",
) -> Problem:
    p = Problem(
        slug=slug,
        title="Judge Problem",
        statement_md="Test",
        input_format="Input",
        output_format="Output",
        difficulty=1,
        author_id=author_id,
        visibility=Visibility.public,
        updated_at=datetime.now(UTC),
        comparison_mode=comparison_mode,
        float_epsilon=float_epsilon,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


async def _make_test_case(
    db: AsyncSession,
    problem_id: uuid.UUID,
    ordinal: int,
    expected_output: bytes,
    *,
    score: int = 10,
    is_sample: bool = False,
) -> TestCase:
    in_path, out_path = await save_test_case(problem_id, ordinal, b"input\n", expected_output)
    tc = TestCase(
        problem_id=problem_id,
        ordinal=ordinal,
        input_path=in_path,
        output_path=out_path,
        score=score,
        is_sample=is_sample,
        is_hidden=not is_sample,
    )
    db.add(tc)
    await db.commit()
    await db.refresh(tc)
    return tc


async def _make_submission(
    db: AsyncSession,
    user_id: uuid.UUID,
    problem_id: uuid.UUID,
    *,
    code: str = "print(42)",
    language: str = "python",
) -> Submission:
    sub = Submission(
        user_id=user_id,
        problem_id=problem_id,
        submitted_code=code,
        language=language,
        verdict=Verdict.pending,
        score=0,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


def _ok_result(stdout: str = "42\n") -> ExecutionResult:
    return ExecutionResult(
        stdout=stdout,
        stderr="",
        exit_code=0,
        compile_error=False,
        time_ms=50,
        memory_kb=1024,
        timed_out=False,
    )


@pytest.mark.asyncio
async def test_judge_exact_ac(db_session: AsyncSession) -> None:
    user = await _make_user(db_session)
    problem = await _make_problem(db_session, user.id)
    await _make_test_case(db_session, problem.id, 1, b"42\n", score=10)
    await _make_test_case(db_session, problem.id, 2, b"42\n", score=20)

    sub = await _make_submission(db_session, user.id, problem.id)

    with patch(
        "app.judging.piston_client.execute", new_callable=AsyncMock, return_value=_ok_result()
    ):
        await judge_submission(sub.id, db_session)

    await db_session.refresh(sub)
    assert sub.verdict == Verdict.AC
    assert sub.score == 30
    assert sub.judged_at is not None


@pytest.mark.asyncio
async def test_judge_exact_wa(db_session: AsyncSession) -> None:
    user = await _make_user(db_session)
    problem = await _make_problem(db_session, user.id, slug="judge-wa")
    await _make_test_case(db_session, problem.id, 1, b"42\n", score=10)

    sub = await _make_submission(db_session, user.id, problem.id)

    with patch(
        "app.judging.piston_client.execute", new_callable=AsyncMock, return_value=_ok_result("99\n")
    ):
        await judge_submission(sub.id, db_session)

    await db_session.refresh(sub)
    assert sub.verdict == Verdict.WA
    assert sub.score == 0


@pytest.mark.asyncio
async def test_judge_partial_scoring(db_session: AsyncSession) -> None:
    """PARTIAL verdict when some test cases pass and others fail."""
    user = await _make_user(db_session)
    problem = await _make_problem(db_session, user.id, slug="judge-partial")
    await _make_test_case(db_session, problem.id, 1, b"42\n", score=10)
    await _make_test_case(db_session, problem.id, 2, b"99\n", score=20)
    await _make_test_case(db_session, problem.id, 3, b"42\n", score=30)

    sub = await _make_submission(db_session, user.id, problem.id)

    side_effects = [_ok_result("42\n"), _ok_result("42\n"), _ok_result("42\n")]
    with patch(
        "app.judging.piston_client.execute", new_callable=AsyncMock, side_effect=side_effects
    ):
        await judge_submission(sub.id, db_session)

    await db_session.refresh(sub)
    assert sub.verdict == Verdict.PARTIAL
    assert sub.score == 40  # tc1 + tc3

    results = (
        (
            await db_session.execute(
                __import__("sqlalchemy", fromlist=["select"])
                .select(SubmissionResult)
                .where(SubmissionResult.submission_id == sub.id)
            )
        )
        .scalars()
        .all()
    )
    verdicts = {r.verdict for r in results}
    assert Verdict.AC in verdicts
    assert Verdict.WA in verdicts


@pytest.mark.asyncio
async def test_judge_whitespace_insensitive(db_session: AsyncSession) -> None:
    user = await _make_user(db_session)
    problem = await _make_problem(
        db_session, user.id, comparison_mode=ComparisonMode.whitespace_insensitive, slug="judge-ws"
    )
    await _make_test_case(db_session, problem.id, 1, b"42\n", score=10)

    sub = await _make_submission(db_session, user.id, problem.id)

    with patch(
        "app.judging.piston_client.execute",
        new_callable=AsyncMock,
        return_value=_ok_result("42   \n\n"),
    ):
        await judge_submission(sub.id, db_session)

    await db_session.refresh(sub)
    assert sub.verdict == Verdict.AC


@pytest.mark.asyncio
async def test_judge_float_epsilon_ac(db_session: AsyncSession) -> None:
    user = await _make_user(db_session)
    problem = await _make_problem(
        db_session,
        user.id,
        comparison_mode=ComparisonMode.float_epsilon,
        float_epsilon=1e-6,
        slug="judge-float-ac",
    )
    await _make_test_case(db_session, problem.id, 1, b"3.14159265\n", score=10)

    sub = await _make_submission(db_session, user.id, problem.id)

    with patch(
        "app.judging.piston_client.execute",
        new_callable=AsyncMock,
        return_value=_ok_result("3.14159266\n"),
    ):
        await judge_submission(sub.id, db_session)

    await db_session.refresh(sub)
    assert sub.verdict == Verdict.AC


@pytest.mark.asyncio
async def test_judge_float_epsilon_wa(db_session: AsyncSession) -> None:
    user = await _make_user(db_session)
    problem = await _make_problem(
        db_session,
        user.id,
        comparison_mode=ComparisonMode.float_epsilon,
        float_epsilon=1e-9,
        slug="judge-float-wa",
    )
    await _make_test_case(db_session, problem.id, 1, b"3.14\n", score=10)

    sub = await _make_submission(db_session, user.id, problem.id)

    with patch(
        "app.judging.piston_client.execute",
        new_callable=AsyncMock,
        return_value=_ok_result("3.15\n"),
    ):
        await judge_submission(sub.id, db_session)

    await db_session.refresh(sub)
    assert sub.verdict == Verdict.WA
    assert sub.score == 0


@pytest.mark.asyncio
async def test_judge_compile_error(db_session: AsyncSession) -> None:
    """CE verdict when Piston reports a compile error; all test cases marked CE."""
    user = await _make_user(db_session)
    problem = await _make_problem(db_session, user.id, slug="judge-ce")
    await _make_test_case(db_session, problem.id, 1, b"42\n", score=10)
    await _make_test_case(db_session, problem.id, 2, b"42\n", score=10)

    sub = await _make_submission(db_session, user.id, problem.id, language="cpp")

    ce_result = ExecutionResult(
        stdout="",
        stderr="main.cpp:1: error: expected ';'",
        exit_code=1,
        compile_error=True,
        time_ms=0,
        memory_kb=0,
        timed_out=False,
    )
    with patch("app.judging.piston_client.execute", new_callable=AsyncMock, return_value=ce_result):
        await judge_submission(sub.id, db_session)

    await db_session.refresh(sub)
    assert sub.verdict == Verdict.CE
    assert sub.score == 0

    results = (
        (
            await db_session.execute(
                select(SubmissionResult).where(SubmissionResult.submission_id == sub.id)
            )
        )
        .scalars()
        .all()
    )
    assert len(results) == 2
    assert all(r.verdict == Verdict.CE for r in results)


@pytest.mark.asyncio
async def test_judge_runtime_error(db_session: AsyncSession) -> None:
    user = await _make_user(db_session)
    problem = await _make_problem(db_session, user.id, slug="judge-re")
    await _make_test_case(db_session, problem.id, 1, b"42\n", score=10)

    sub = await _make_submission(db_session, user.id, problem.id)

    re_result = ExecutionResult(
        stdout="",
        stderr="Segmentation fault",
        exit_code=139,
        compile_error=False,
        time_ms=10,
        memory_kb=512,
        timed_out=False,
    )
    with patch("app.judging.piston_client.execute", new_callable=AsyncMock, return_value=re_result):
        await judge_submission(sub.id, db_session)

    await db_session.refresh(sub)
    assert sub.verdict == Verdict.WA  # passed == 0 → WA overall

    results = (
        (
            await db_session.execute(
                select(SubmissionResult).where(SubmissionResult.submission_id == sub.id)
            )
        )
        .scalars()
        .all()
    )
    assert results[0].verdict == Verdict.RE


@pytest.mark.asyncio
async def test_judge_tle(db_session: AsyncSession) -> None:
    user = await _make_user(db_session)
    problem = await _make_problem(db_session, user.id, slug="judge-tle")
    await _make_test_case(db_session, problem.id, 1, b"42\n", score=10)

    sub = await _make_submission(db_session, user.id, problem.id)

    tle_result = ExecutionResult(
        stdout="",
        stderr="",
        exit_code=137,
        compile_error=False,
        time_ms=1000,
        memory_kb=512,
        timed_out=True,
    )
    with patch(
        "app.judging.piston_client.execute", new_callable=AsyncMock, return_value=tle_result
    ):
        await judge_submission(sub.id, db_session)

    await db_session.refresh(sub)
    results = (
        (
            await db_session.execute(
                select(SubmissionResult).where(SubmissionResult.submission_id == sub.id)
            )
        )
        .scalars()
        .all()
    )
    assert results[0].verdict == Verdict.TLE


@pytest.mark.asyncio
async def test_judge_missing_expected_output_file(db_session: AsyncSession) -> None:
    """WA per test case when the expected .out file is missing from disk."""
    user = await _make_user(db_session)
    problem = await _make_problem(db_session, user.id, slug="judge-missing-out")
    in_path, _ = await save_test_case(problem.id, 1, b"input\n", b"42\n")
    tc = TestCase(
        problem_id=problem.id,
        ordinal=1,
        input_path=in_path,
        output_path="/tmp/nonexistent-reinfo-test-expected.out",
        score=10,
        is_sample=False,
        is_hidden=True,
    )
    db_session.add(tc)
    await db_session.commit()

    sub = await _make_submission(db_session, user.id, problem.id)

    with patch(
        "app.judging.piston_client.execute", new_callable=AsyncMock, return_value=_ok_result()
    ):
        await judge_submission(sub.id, db_session)

    await db_session.refresh(sub)
    assert sub.verdict == Verdict.WA
    assert sub.score == 0


@pytest.mark.asyncio
async def test_judge_skips_sample_test_cases(db_session: AsyncSession) -> None:
    """Sample test cases must not affect the verdict."""
    user = await _make_user(db_session)
    problem = await _make_problem(db_session, user.id, slug="judge-sample")
    await _make_test_case(db_session, problem.id, 0, b"wrong\n", score=10, is_sample=True)
    await _make_test_case(db_session, problem.id, 1, b"42\n", score=10, is_sample=False)

    sub = await _make_submission(db_session, user.id, problem.id)

    with patch(
        "app.judging.piston_client.execute", new_callable=AsyncMock, return_value=_ok_result()
    ):
        await judge_submission(sub.id, db_session)

    await db_session.refresh(sub)
    assert sub.verdict == Verdict.AC


@pytest.mark.asyncio
async def test_judge_no_test_cases(db_session: AsyncSession) -> None:
    user = await _make_user(db_session)
    problem = await _make_problem(db_session, user.id, slug="judge-no-tc")

    sub = await _make_submission(db_session, user.id, problem.id)
    await judge_submission(sub.id, db_session)

    await db_session.refresh(sub)
    assert sub.verdict == Verdict.AC
    assert sub.score == 0


@pytest.mark.asyncio
async def test_judge_result_stores_timing(db_session: AsyncSession) -> None:
    """execution_time_ms and memory_kb are stored in SubmissionResult."""
    user = await _make_user(db_session)
    problem = await _make_problem(db_session, user.id, slug="judge-timing")
    await _make_test_case(db_session, problem.id, 1, b"42\n", score=10)

    sub = await _make_submission(db_session, user.id, problem.id)

    timed_result = ExecutionResult(
        stdout="42\n",
        stderr="",
        exit_code=0,
        compile_error=False,
        time_ms=123,
        memory_kb=2048,
        timed_out=False,
    )
    with patch(
        "app.judging.piston_client.execute", new_callable=AsyncMock, return_value=timed_result
    ):
        await judge_submission(sub.id, db_session)

    result_row = (
        await db_session.execute(
            select(SubmissionResult).where(SubmissionResult.submission_id == sub.id)
        )
    ).scalar_one()
    assert result_row.execution_time_ms == 123
    assert result_row.memory_kb == 2048
