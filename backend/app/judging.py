"""judging engine: runs each non-sample test case via piston, maps results to per-test verdicts, sets overall verdict and score"""

import io
import uuid
from datetime import UTC, datetime

import aiofiles
import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import piston as piston_client
from app import storage
from app.config import settings
from app.metrics import FormatError, compute_metric, score_from_metric, validate_submission_shape
from app.models.contest import Contest
from app.models.duel import Duel, DuelStatus
from app.models.problem import ComparisonMode, DatasetMetric, Problem, ProblemType
from app.models.submission import Submission, SubmissionResult, Verdict
from app.realtime import publish_contest_update, publish_duel_update

_DATASET_REPRO_SCORE_TOLERANCE = 5

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
    """execute and judge a submission against all non-sample test cases; updates the submission and inserts a result row per test case"""
    submission = await session.scalar(
        select(Submission)
        .where(Submission.id == submission_id)
        .options(selectinload(Submission.problem).selectinload(Problem.test_cases))
    )
    if submission is None:
        return

    problem = submission.problem

    if problem.problem_type == ProblemType.dataset:
        await judge_dataset_submission(submission, problem, session)
        return

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
    await _update_duel_if_any(session, submission)
    await session.commit()


async def judge_dataset_submission(
    submission: Submission, problem: Problem, session: AsyncSession
) -> None:
    """judge a csv submission for a dataset/ai problem against answer.csv; pure pandas comparison, malformed input yields invalid_format"""
    now = datetime.now(UTC)

    async def _fail(message: str) -> None:
        submission.verdict = Verdict.INVALID_FORMAT
        submission.score = 0
        submission.judged_at = now
        session.add(
            SubmissionResult(
                submission_id=submission.id,
                verdict=Verdict.INVALID_FORMAT,
                score=0,
                message=message,
            )
        )
        await _notify_contest_if_any(session, submission)
        await session.commit()

    if submission.dataset_csv_path is None:
        await _fail("Nu a fost trimis niciun fișier CSV")
        return

    try:
        csv_bytes = await storage.read_test_case(submission.dataset_csv_path)
    except FileNotFoundError:
        await _fail("Fișierul CSV trimis nu a putut fi citit de pe server")
        return

    try:
        submission_df = pd.read_csv(io.BytesIO(csv_bytes))
    except Exception as exc:
        await _fail(f"CSV invalid: {exc}")
        return

    try:
        answer_bytes = await storage.read_dataset_file(problem.slug, "answer.csv")
    except FileNotFoundError:
        await _fail("Configurarea setului de date a problemei este incompletă")
        return

    answer_df = pd.read_csv(io.BytesIO(answer_bytes))
    id_column = problem.dataset_id_column or "id"
    target_column = problem.dataset_target_column or "target"

    try:
        validate_submission_shape(
            submission_df, answer_df, id_column, target_column, problem.dataset_expected_rows
        )
    except FormatError as exc:
        await _fail(str(exc))
        return
    except Exception as exc:
        await _fail(f"CSV invalid: {exc}")
        return

    metric = problem.dataset_metric
    if metric is None:
        await _fail("Problema nu are configurată o metrică de evaluare")
        return

    metric_value = compute_metric(metric, submission_df, answer_df, id_column, target_column)
    score = score_from_metric(metric, metric_value, problem.metric_threshold)
    verdict = Verdict.AC if score >= 100 else (Verdict.PARTIAL if score > 0 else Verdict.WA)

    submission.verdict = verdict
    submission.score = score
    submission.judged_at = now
    session.add(
        SubmissionResult(
            submission_id=submission.id,
            verdict=verdict,
            score=score,
            message=f"{metric.value} = {metric_value:.4f}",
            metric_value=metric_value,
        )
    )

    if settings.enable_dataset_repro and submission.submitted_code:
        await _run_dataset_repro(submission, problem, metric, score)

    await _notify_contest_if_any(session, submission)
    await session.commit()


async def _run_dataset_repro(
    submission: Submission,
    problem: Problem,
    metric: DatasetMetric,
    graded_score: int,
) -> None:
    """re-run the submitted .py against test.csv and flag manual review on a material mismatch; never changes verdict/score"""
    try:
        test_csv = await storage.read_dataset_file(problem.slug, "test.csv")
    except FileNotFoundError:
        return

    exec_result = await piston_client.execute(
        language="python",
        code=submission.submitted_code or "",
        stdin=test_csv.decode("utf-8", errors="replace"),
        time_limit_ms=problem.time_limit_ms,
        memory_limit_kb=problem.memory_limit_kb,
    )

    if exec_result.compile_error or exec_result.timed_out or exec_result.exit_code != 0:
        submission.manual_review = True
        return

    try:
        repro_df = pd.read_csv(io.StringIO(exec_result.stdout))
        answer_bytes = await storage.read_dataset_file(problem.slug, "answer.csv")
        answer_df = pd.read_csv(io.BytesIO(answer_bytes))
        id_column = problem.dataset_id_column or "id"
        target_column = problem.dataset_target_column or "target"
        validate_submission_shape(
            repro_df, answer_df, id_column, target_column, problem.dataset_expected_rows
        )
        repro_value = compute_metric(metric, repro_df, answer_df, id_column, target_column)
        repro_score = score_from_metric(metric, repro_value, problem.metric_threshold)
    except Exception:
        submission.manual_review = True
        return

    if abs(repro_score - graded_score) > _DATASET_REPRO_SCORE_TOLERANCE:
        submission.manual_review = True


async def _notify_contest_if_any(session: AsyncSession, submission: Submission) -> None:
    """emit a notify for the contest leaderboard channel if this submission belongs to a contest"""
    if submission.contest_id is None:
        return
    slug = await session.scalar(select(Contest.slug).where(Contest.id == submission.contest_id))
    if slug:
        await publish_contest_update(session, slug)


_ELO_K = 32


def _elo_change(rating_a: int, rating_b: int, score_a: float) -> int:
    """return the rating change for player a; score_a is 1 (win), 0.5 (draw), 0 (loss)"""
    expected = 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / 400.0))
    return round(_ELO_K * (score_a - expected))


async def _update_duel_if_any(session: AsyncSession, submission: Submission) -> None:
    """update duel state after a submission is judged, finishes the duel on ac"""
    if submission.duel_id is None:
        return

    from datetime import UTC, datetime

    from app.models.duel import DuelRatingHistory
    from app.models.user import User

    duel = await session.scalar(select(Duel).where(Duel.id == submission.duel_id))
    if duel is None or duel.status != DuelStatus.active:
        return

    is_challenger = submission.user_id == duel.challenger_id
    current_score = duel.challenger_score if is_challenger else duel.opponent_score

    if submission.score > current_score:
        if is_challenger:
            duel.challenger_score = submission.score
        else:
            duel.opponent_score = submission.score

    if submission.verdict == Verdict.AC:
        now = datetime.now(UTC)
        duel.status = DuelStatus.finished
        duel.finished_at = now
        duel.winner_id = submission.user_id

        challenger = await session.get(User, duel.challenger_id)
        opponent = await session.get(User, duel.opponent_id)
        if challenger and opponent:
            winner_is_challenger = submission.user_id == duel.challenger_id
            c_change = _elo_change(
                challenger.duel_rating, opponent.duel_rating, 1.0 if winner_is_challenger else 0.0
            )
            o_change = _elo_change(
                opponent.duel_rating, challenger.duel_rating, 0.0 if winner_is_challenger else 1.0
            )

            session.add(
                DuelRatingHistory(
                    user_id=challenger.id,
                    duel_id=duel.id,
                    rating_before=challenger.duel_rating,
                    rating_after=max(0, challenger.duel_rating + c_change),
                )
            )
            session.add(
                DuelRatingHistory(
                    user_id=opponent.id,
                    duel_id=duel.id,
                    rating_before=opponent.duel_rating,
                    rating_after=max(0, opponent.duel_rating + o_change),
                )
            )

            challenger.duel_rating = max(0, challenger.duel_rating + c_change)
            opponent.duel_rating = max(0, opponent.duel_rating + o_change)
            if winner_is_challenger:
                challenger.duel_wins += 1
                opponent.duel_losses += 1
            else:
                opponent.duel_wins += 1
                challenger.duel_losses += 1

    await publish_duel_update(session, str(duel.id))
