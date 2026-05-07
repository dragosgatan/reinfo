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


class SubmissionRead(BaseModel):
    """Full submission detail including per-test results."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    problem_id: uuid.UUID
    contest_id: uuid.UUID | None
    verdict: Verdict
    score: int
    language: str | None
    created_at: datetime
    judged_at: datetime | None
    results: list[SubmissionResultRead] = []


class SubmissionSummary(BaseModel):
    """Submission without per-test results, used in list views."""

    id: uuid.UUID
    user_id: uuid.UUID
    problem_id: uuid.UUID
    problem_slug: str
    contest_id: uuid.UUID | None
    verdict: Verdict
    score: int
    language: str | None
    created_at: datetime
    judged_at: datetime | None


class SubmissionListResponse(BaseModel):
    items: list[SubmissionSummary]
    total: int
    page: int
    per_page: int
    pages: int
