import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.submission import Verdict


class SubmissionCreate(BaseModel):
    problem_id: uuid.UUID
    contest_id: uuid.UUID | None = None
    language: str | None = None


class SubmissionResultRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    test_case_id: uuid.UUID
    verdict: Verdict
    score: int
    message: str | None
    actual_output: str | None
    expected_output_snippet: str | None
    execution_time_ms: int | None
    memory_kb: int | None


class SubmissionRead(BaseModel):
    """Full submission detail including per-test results and source code."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    problem_id: uuid.UUID
    problem_slug: str = ""
    contest_id: uuid.UUID | None
    verdict: Verdict
    score: int
    language: str
    submitted_code: str
    created_at: datetime
    judged_at: datetime | None
    results: list[SubmissionResultRead] = []


class SubmissionSummary(BaseModel):
    """Submission without per-test results, used in list views."""

    id: uuid.UUID
    user_id: uuid.UUID
    problem_id: uuid.UUID
    problem_slug: str
    problem_title: str
    contest_id: uuid.UUID | None
    verdict: Verdict
    score: int
    language: str
    created_at: datetime
    judged_at: datetime | None


class SubmissionListResponse(BaseModel):
    items: list[SubmissionSummary]
    total: int
    page: int
    per_page: int
    pages: int
