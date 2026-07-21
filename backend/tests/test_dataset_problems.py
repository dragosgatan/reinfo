"""Tests for dataset/AI problem judging: metric math, format validation, contest gating."""

import uuid
from datetime import UTC, datetime, timedelta
from io import BytesIO

import pandas as pd
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.metrics import FormatError, compute_metric, score_from_metric, validate_submission_shape
from app.models.contest import Contest, ContestParticipant, ContestProblem
from app.models.problem import DatasetMetric, Problem, ProblemType, Visibility
from app.models.user import User, UserRole
from app.security import hash_password
from app.storage import save_dataset_file
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


async def _make_dataset_problem(
    db: AsyncSession,
    author_id: uuid.UUID | None,
    slug: str = "titanic",
    metric: DatasetMetric = DatasetMetric.accuracy,
    metric_threshold: float | None = None,
    id_column: str = "id",
    target_column: str = "target",
    expected_rows: int | None = None,
    require_source_in_contest: bool = True,
    visibility: Visibility = Visibility.public,
) -> Problem:
    problem = Problem(
        slug=slug,
        title="Dataset Problem",
        statement_md="Predict the target.",
        input_format="",
        output_format="",
        difficulty=4,
        author_id=author_id,
        visibility=visibility,
        updated_at=datetime.now(UTC),
        problem_type=ProblemType.dataset,
        dataset_metric=metric,
        metric_threshold=metric_threshold,
        dataset_id_column=id_column,
        dataset_target_column=target_column,
        dataset_expected_rows=expected_rows,
        require_source_in_contest=require_source_in_contest,
    )
    db.add(problem)
    await db.commit()
    await db.refresh(problem)
    return problem


async def _set_answer(slug: str, csv_text: str) -> None:
    await save_dataset_file(slug, "answer.csv", csv_text.encode())


def _csv_bytes(text: str) -> BytesIO:
    return BytesIO(text.encode())


class TestMetricMath:
    def test_accuracy(self) -> None:
        sub = pd.DataFrame({"id": [1, 2, 3, 4], "target": [1, 0, 1, 1]})
        ans = pd.DataFrame({"id": [1, 2, 3, 4], "target": [1, 0, 0, 1]})
        value = compute_metric(DatasetMetric.accuracy, sub, ans, "id", "target")
        assert value == pytest.approx(0.75)

    def test_f1_binary(self) -> None:
        sub = pd.DataFrame({"id": [1, 2, 3, 4], "target": [1, 1, 0, 0]})
        ans = pd.DataFrame({"id": [1, 2, 3, 4], "target": [1, 0, 0, 0]})
        value = compute_metric(DatasetMetric.f1, sub, ans, "id", "target")
        # class 1: tp=1 fp=1 fn=0 -> p=.5 r=1 f1=.667; class 0: tp=2 fp=0 fn=1 -> p=1 r=.667 f1=.8
        assert value == pytest.approx((0.6667 + 0.8) / 2, abs=1e-3)

    def test_rmse(self) -> None:
        sub = pd.DataFrame({"id": [1, 2], "target": [3.0, 5.0]})
        ans = pd.DataFrame({"id": [1, 2], "target": [1.0, 5.0]})
        value = compute_metric(DatasetMetric.rmse, sub, ans, "id", "target")
        assert value == pytest.approx((2.0**2 / 2) ** 0.5)

    def test_mae(self) -> None:
        sub = pd.DataFrame({"id": [1, 2], "target": [3.0, 5.0]})
        ans = pd.DataFrame({"id": [1, 2], "target": [1.0, 5.0]})
        value = compute_metric(DatasetMetric.mae, sub, ans, "id", "target")
        assert value == pytest.approx(1.0)

    def test_metric_aligns_by_id_regardless_of_row_order(self) -> None:
        sub = pd.DataFrame({"id": [2, 1], "target": [0, 1]})
        ans = pd.DataFrame({"id": [1, 2], "target": [1, 0]})
        value = compute_metric(DatasetMetric.accuracy, sub, ans, "id", "target")
        assert value == pytest.approx(1.0)


class TestScoreFromMetric:
    def test_accuracy_no_threshold_scales_directly(self) -> None:
        assert score_from_metric(DatasetMetric.accuracy, 0.8, None) == 80

    def test_accuracy_meets_threshold_scores_100(self) -> None:
        assert score_from_metric(DatasetMetric.accuracy, 0.9, 0.85) == 100

    def test_accuracy_below_threshold_scales_proportionally(self) -> None:
        assert score_from_metric(DatasetMetric.accuracy, 0.5, 1.0) == 50

    def test_rmse_no_threshold_scores_zero(self) -> None:
        assert score_from_metric(DatasetMetric.rmse, 0.1, None) == 0

    def test_rmse_within_threshold_scores_100(self) -> None:
        assert score_from_metric(DatasetMetric.rmse, 1.0, 2.0) == 100

    def test_rmse_double_threshold_scores_zero(self) -> None:
        assert score_from_metric(DatasetMetric.rmse, 4.0, 2.0) == 0

    def test_rmse_falls_off_linearly(self) -> None:
        assert score_from_metric(DatasetMetric.rmse, 3.0, 2.0) == 50


class TestValidateShape:
    def test_missing_target_column(self) -> None:
        sub = pd.DataFrame({"id": [1, 2]})
        ans = pd.DataFrame({"id": [1, 2], "target": [1, 0]})
        with pytest.raises(FormatError, match="target"):
            validate_submission_shape(sub, ans, "id", "target", None)

    def test_wrong_row_count(self) -> None:
        sub = pd.DataFrame({"id": [1, 2], "target": [1, 0]})
        ans = pd.DataFrame({"id": [1, 2, 3], "target": [1, 0, 1]})
        with pytest.raises(FormatError, match="rânduri"):
            validate_submission_shape(sub, ans, "id", "target", 3)

    def test_nan_in_target(self) -> None:
        sub = pd.DataFrame({"id": [1, 2], "target": [1, None]})
        ans = pd.DataFrame({"id": [1, 2], "target": [1, 0]})
        with pytest.raises(FormatError, match="lipsă"):
            validate_submission_shape(sub, ans, "id", "target", None)

    def test_id_mismatch(self) -> None:
        sub = pd.DataFrame({"id": [1, 5], "target": [1, 0]})
        ans = pd.DataFrame({"id": [1, 2], "target": [1, 0]})
        with pytest.raises(FormatError, match="id"):
            validate_submission_shape(sub, ans, "id", "target", None)

    def test_duplicate_ids(self) -> None:
        sub = pd.DataFrame({"id": [1, 1], "target": [1, 0]})
        ans = pd.DataFrame({"id": [1, 2], "target": [1, 0]})
        with pytest.raises(FormatError, match="duplicate"):
            validate_submission_shape(sub, ans, "id", "target", None)

    def test_valid_shape_does_not_raise(self) -> None:
        sub = pd.DataFrame({"id": [1, 2], "target": [1, 0]})
        ans = pd.DataFrame({"id": [1, 2], "target": [1, 0]})
        validate_submission_shape(sub, ans, "id", "target", 2)


@pytest.mark.asyncio
async def test_submit_dataset_ac(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "ds1")
    problem = await _make_dataset_problem(db_session, user.id, slug="ds-ac")
    await _set_answer("ds-ac", "id,target\n1,1\n2,0\n3,1\n")
    await _login(client, "ds1")

    r = await client.post(
        f"/api/problems/{problem.slug}/submit-dataset",
        files={"csv_file": ("pred.csv", _csv_bytes("id,target\n1,1\n2,0\n3,1\n"), "text/csv")},
    )
    assert r.status_code == 201
    sub_id = r.json()["id"]

    await process_one_job(db_session)
    body = (await client.get(f"/api/submissions/{sub_id}")).json()
    assert body["verdict"] == "AC"
    assert body["score"] == 100
    assert body["results"][0]["metric_value"] == pytest.approx(1.0)


@pytest.mark.asyncio
async def test_submit_dataset_invalid_format_missing_column(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    user = await _make_user(db_session, "ds2")
    problem = await _make_dataset_problem(db_session, user.id, slug="ds-badformat")
    await _set_answer("ds-badformat", "id,target\n1,1\n2,0\n")
    await _login(client, "ds2")

    r = await client.post(
        f"/api/problems/{problem.slug}/submit-dataset",
        files={"csv_file": ("pred.csv", _csv_bytes("id,prediction\n1,1\n2,0\n"), "text/csv")},
    )
    assert r.status_code == 201
    sub_id = r.json()["id"]

    await process_one_job(db_session)
    body = (await client.get(f"/api/submissions/{sub_id}")).json()
    assert body["verdict"] == "INVALID_FORMAT"
    assert body["score"] == 0
    assert "target" in body["results"][0]["message"]


@pytest.mark.asyncio
async def test_submit_dataset_invalid_format_malformed_csv(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    user = await _make_user(db_session, "ds3")
    problem = await _make_dataset_problem(db_session, user.id, slug="ds-malformed")
    await _set_answer("ds-malformed", "id,target\n1,1\n2,0\n")
    await _login(client, "ds3")

    r = await client.post(
        f"/api/problems/{problem.slug}/submit-dataset",
        files={"csv_file": ("pred.csv", _csv_bytes(""), "text/csv")},
    )
    assert r.status_code == 201
    sub_id = r.json()["id"]

    await process_one_job(db_session)
    body = (await client.get(f"/api/submissions/{sub_id}")).json()
    assert body["verdict"] == "INVALID_FORMAT"


@pytest.mark.asyncio
async def test_contest_dataset_submit_without_source_rejected(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    teacher = await _make_user(db_session, "ds-teacher", UserRole.teacher)
    student = await _make_user(db_session, "ds-student")
    problem = await _make_dataset_problem(
        db_session,
        teacher.id,
        slug="ds-contest",
        require_source_in_contest=True,
        visibility=Visibility.contest,
    )
    await _set_answer("ds-contest", "id,target\n1,1\n2,0\n")

    now = datetime.now(UTC)
    contest = Contest(
        slug="ds-contest-event",
        title="Dataset Contest",
        description_md="",
        start_time=now.replace(microsecond=0) - timedelta(minutes=5),
        end_time=now.replace(microsecond=0) + timedelta(hours=1),
        created_by=teacher.id,
    )
    db_session.add(contest)
    await db_session.commit()
    await db_session.refresh(contest)

    db_session.add(ContestProblem(contest_id=contest.id, problem_id=problem.id, ordinal=1))
    db_session.add(ContestParticipant(contest_id=contest.id, user_id=student.id))
    await db_session.commit()

    await _login(client, "ds-student")

    r = await client.post(
        f"/api/contests/{contest.slug}/problems/{problem.slug}/submit-dataset",
        files={"csv_file": ("pred.csv", _csv_bytes("id,target\n1,1\n2,0\n"), "text/csv")},
    )
    assert r.status_code == 422

    r2 = await client.post(
        f"/api/contests/{contest.slug}/problems/{problem.slug}/submit-dataset",
        files={
            "csv_file": ("pred.csv", _csv_bytes("id,target\n1,1\n2,0\n"), "text/csv"),
            "source_file": ("solve.py", _csv_bytes("print('ok')"), "text/x-python"),
        },
    )
    assert r2.status_code == 201
    assert r2.json()["submission_kind"] == "dataset"
