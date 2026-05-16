"""Judging engine: executes submitted code via Piston and compares output.

Runs each non-sample test case through the sandbox, maps execution results to
per-test verdicts (CE/TLE/MLE/RE/AC/WA), then sets the submission's overall
verdict and score.
"""

import uuid
from datetime import UTC, datetime

import aiofiles
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import piston as piston_client
from app.models.contest import Contest
from app.models.problem import ComparisonMode, Problem
from app.models.submission import Submission, SubmissionResult, Verdict
from app.realtime import publish_contest_update

_SNIPPET_MAX_LINES = 50


def _truncate_to_snippet(text: str) -> str:
    lines = text.splitlines()
    return "\n".join(lines[:_SNIPPET_MAX_LINES])


def _compare_exact(expected: bytes, actual: bytes) -> tuple[bool, str | None]:
    return expected.rstrip(b"\r\n") == actual.rstrip(b"\r\n"), None


def _normalize_ws(data: bytes) -> list[str]:
    lines = [line.strip() for line in data.decode("utf-8", errors="replace").splitlines()]
    while lines and not lines[-1]:
        lines.pop()
    return lines


def _compare_whitespace_insensitive(expected: bytes, actual: bytes) -> tuple[bool, str | None]:
    return _normalize_ws(expected) == _normalize_ws(actual), None


def _compare_float_epsilon(
    expected: bytes, actual: bytes, epsilon: float
) -> tuple[bool, str | None]:
    def _parse(data: bytes) -> list[float]:
        return [float(tok) for tok in data.decode("utf-8", errors="replace").split()]

    try:
        exp_vals = _parse(expected)
        act_vals = _parse(actual)
    except ValueError as exc:
        return False, f"Eroare parsare: {exc}"

    if len(exp_vals) != len(act_vals):
        return False, f"Număr diferit: așteptat {len(exp_vals)}, primit {len(act_vals)}"

    for i, (e, a) in enumerate(zip(exp_vals, act_vals, strict=False)):
        if abs(e - a) > epsilon * max(1.0, abs(e)):
            return False, f"Valoarea #{i}: |{e} - {a}| > {epsilon}"

    return True, None


async def judge_submission(submission_id: uuid.UUID, session: AsyncSession) -> None:
    """Execute and judge a submission against all non-sample test cases.

    Updates verdict, score, judged_at on the Submission and inserts
    one SubmissionResult row per test case.
    """
    submission = await session.scalar(
        select(Submission)
        .where(Submission.id == submission_id)
        .options(selectinload(Submission.problem).selectinload(Problem.test_cases))
    )
    if submission is None:
        return

    problem = submission.problem
    test_cases = [tc for tc in problem.test_cases if not tc.is_sample]

    now = datetime.now(UTC)

    if not test_cases:
        submission.verdict = Verdict.AC
        submission.score = 0
        submission.judged_at = now
        await _notify_contest_if_any(session, submission)
        await session.commit()
        return

    results: list[SubmissionResult] = []
    total_score = 0
    passed = 0
    got_compile_error = False

    for tc in test_cases:
        if got_compile_error:
            results.append(
                SubmissionResult(
                    submission_id=submission_id,
                    test_case_id=tc.id,
                    verdict=Verdict.CE,
                    score=0,
                    message="Eroare de compilare",
                )
            )
            continue

        try:
            async with aiofiles.open(tc.input_path, "rb") as fh:
                stdin_bytes = await fh.read()
        except FileNotFoundError:
            results.append(
                SubmissionResult(
                    submission_id=submission_id,
                    test_case_id=tc.id,
                    verdict=Verdict.RE,
                    score=0,
                    message="Fișierul de intrare lipsește de pe server",
                )
            )
            continue

        try:
            async with aiofiles.open(tc.output_path, "rb") as fh:
                expected_bytes = await fh.read()
        except FileNotFoundError:
            results.append(
                SubmissionResult(
                    submission_id=submission_id,
                    test_case_id=tc.id,
                    verdict=Verdict.WA,
                    score=0,
                    message="Fișierul expected output lipsește de pe server",
                )
            )
            continue

        stdin = stdin_bytes.decode("utf-8", errors="replace")
        exec_result = await piston_client.execute(
            language=submission.language,
            code=submission.submitted_code,
            stdin=stdin,
            time_limit_ms=problem.time_limit_ms,
            memory_limit_kb=problem.memory_limit_kb,
        )

        if exec_result.compile_error:
            got_compile_error = True
            results.append(
                SubmissionResult(
                    submission_id=submission_id,
                    test_case_id=tc.id,
                    verdict=Verdict.CE,
                    score=0,
                    message=(exec_result.stderr[:500] if exec_result.stderr else None),
                    execution_time_ms=None,
                    memory_kb=None,
                )
            )
            continue

        wa_actual: str | None = None
        wa_expected: str | None = None

        if exec_result.timed_out:
            tc_verdict = Verdict.TLE
            tc_score = 0
            tc_message = None
        elif exec_result.memory_kb > problem.memory_limit_kb:
            tc_verdict = Verdict.MLE
            tc_score = 0
            tc_message = None
        elif exec_result.exit_code != 0:
            tc_verdict = Verdict.RE
            tc_score = 0
            tc_message = exec_result.stderr[:500] if exec_result.stderr else None
        else:
            actual_bytes = exec_result.stdout.encode("utf-8")
            if problem.comparison_mode == ComparisonMode.exact:
                ok, msg = _compare_exact(expected_bytes, actual_bytes)
            elif problem.comparison_mode == ComparisonMode.whitespace_insensitive:
                ok, msg = _compare_whitespace_insensitive(expected_bytes, actual_bytes)
            else:
                eps = problem.float_epsilon or 1e-9
                ok, msg = _compare_float_epsilon(expected_bytes, actual_bytes, eps)

            tc_verdict = Verdict.AC if ok else Verdict.WA
            tc_score = tc.score if ok else 0
            tc_message = None if ok else msg
            if not ok:
                wa_actual = _truncate_to_snippet(exec_result.stdout)
                wa_expected = _truncate_to_snippet(expected_bytes.decode("utf-8", errors="replace"))
            if ok:
                passed += 1

        total_score += tc_score
        results.append(
            SubmissionResult(
                submission_id=submission_id,
                test_case_id=tc.id,
                verdict=tc_verdict,
                score=tc_score,
                message=tc_message,
                actual_output=wa_actual,
                expected_output_snippet=wa_expected,
                execution_time_ms=exec_result.time_ms,
                memory_kb=exec_result.memory_kb,
            )
        )

    session.add_all(results)

    if got_compile_error:
        verdict = Verdict.CE
    else:
        n = len(test_cases)
        if passed == n:
            verdict = Verdict.AC
        elif passed == 0:
            verdict = Verdict.WA
        else:
            verdict = Verdict.PARTIAL

    submission.verdict = verdict
    submission.score = total_score
    submission.judged_at = now
    await _notify_contest_if_any(session, submission)
    await session.commit()


async def _notify_contest_if_any(session: AsyncSession, submission: Submission) -> None:
    """Emit a NOTIFY for the contest leaderboard channel, if this submission
    belongs to a contest. Runs in the same transaction as the verdict update
    so subscribers only see the event after commit."""
    if submission.contest_id is None:
        return
    slug = await session.scalar(select(Contest.slug).where(Contest.id == submission.contest_id))
    if slug:
        await publish_contest_update(session, slug)
