"""Pydantic schemas for contests."""

import math
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.contest import ScoringMode


class ContestCreate(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    description_md: str | None = None
    start_time: datetime
    end_time: datetime
    scoring_mode: ScoringMode = ScoringMode.sum

    @model_validator(mode="after")
    def _end_after_start(self) -> "ContestCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time trebuie să fie după start_time")
        return self


class ContestUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=256)
    description_md: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    scoring_mode: ScoringMode | None = None


class ContestProblemEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ordinal: int
    problem_slug: str
    problem_title: str
    score_total: int
    solved_by_user: bool | None = None


class ContestSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    title: str
    start_time: datetime
    end_time: datetime
    scoring_mode: ScoringMode
    participant_count: int
    problem_count: int
    status: Literal["upcoming", "ongoing", "past"]


class ContestDetail(ContestSummary):
    description_md: str | None
    created_by: uuid.UUID | None
    is_registered: bool
    problems: list[ContestProblemEntry]


class ContestListResponse(BaseModel):
    items: list[ContestSummary]
    total: int
    page: int
    per_page: int
    pages: int


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: uuid.UUID
    username: str
    display_name: str
    total_score: int
    problem_scores: dict[str, int]
    last_submission_at: datetime | None


class LeaderboardResponse(BaseModel):
    contest_slug: str
    entries: list[LeaderboardEntry]
    generated_at: datetime


def contest_status(
    now: datetime, start: datetime, end: datetime
) -> Literal["upcoming", "ongoing", "past"]:
    """Compute contest status string relative to now."""
    if now < start:
        return "upcoming"
    if now <= end:
        return "ongoing"
    return "past"


def paginate(total: int, per_page: int) -> int:
    return math.ceil(total / per_page) if total > 0 else 0
