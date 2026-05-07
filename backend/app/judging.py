"""Synchronous judging engine for uploaded output files.

Compares the single submitted .out against every non-sample test case and
writes per-test SubmissionResult rows, then updates the Submission verdict.
"""

import uuid
from datetime import UTC, datetime

import aiofiles
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.problem import ComparisonMode, Problem
from app.models.submission import Submission, SubmissionResult, Verdict


def _compare_exact(expected: bytes, actual: bytes) -> tuple[bool, str | None]:
    return expected == actual, None


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

    for i, (e, a) in enumerate(zip(exp_vals, act_vals)):
        if abs(e - a) > epsilon * max(1.0, abs(e)):
            return False, f"Valoarea #{i}: |{e} - {a}| > {epsilon}"

    return True, None


async def judge_submission(submission_id: uuid.UUID, session: AsyncSession) -> None:
    """Judge a submission against all non-sample test cases.

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
        await session.commit()
        return

    try:
        async with aiofiles.open(submission.submitted_output_path, "rb") as fh:
            submitted = await fh.read()
    except FileNotFoundError:
        results = [
            SubmissionResult(
                submission_id=submission_id,
                test_case_id=tc.id,
                verdict=Verdict.WA,
                score=0,
                message="Fișierul output lipsește",
            )
            for tc in test_cases
        ]
        session.add_all(results)
        submission.verdict = Verdict.WA
        submission.score = 0
        submission.judged_at = now
        await session.commit()
        return

    results: list[SubmissionResult] = []
    total_score = 0
    passed = 0

    for tc in test_cases:
        try:
            async with aiofiles.open(tc.output_path, "rb") as fh:
                expected = await fh.read()
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

        if problem.comparison_mode == ComparisonMode.exact:
            ok, msg = _compare_exact(expected, submitted)
        elif problem.comparison_mode == ComparisonMode.whitespace_insensitive:
            ok, msg = _compare_whitespace_insensitive(expected, submitted)
        else:  # float_epsilon
            eps = problem.float_epsilon or 1e-9
            ok, msg = _compare_float_epsilon(expected, submitted, eps)

        tc_score = tc.score if ok else 0
        total_score += tc_score
        if ok:
            passed += 1

        results.append(
            SubmissionResult(
                submission_id=submission_id,
                test_case_id=tc.id,
                verdict=Verdict.AC if ok else Verdict.WA,
                score=tc_score,
                message=None if ok else msg,
            )
        )

    session.add_all(results)

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
    await session.commit()
