import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.duel import DuelQueueStatus, DuelRequestStatus, DuelStatus
from app.models.submission import Verdict


class DuelRequestCreate(BaseModel):
    to_username: str
    time_limit_minutes: int = Field(ge=5, le=120)
    difficulty_min: int = Field(ge=1, le=10)
    difficulty_max: int = Field(ge=1, le=10)


class DuelRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    from_id: uuid.UUID
    from_username: str
    to_id: uuid.UUID
    to_username: str
    time_limit_minutes: int
    difficulty_min: int
    difficulty_max: int
    status: DuelRequestStatus
    created_at: datetime
    expires_at: datetime


class DuelPlayerState(BaseModel):
    user_id: uuid.UUID
    username: str
    display_name: str
    score: int
    best_verdict: Verdict | None
    duel_rating: int


class DuelRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: DuelStatus
    started_at: datetime | None
    finished_at: datetime | None
    winner_id: uuid.UUID | None
    time_limit_minutes: int
    draw_offered_by: uuid.UUID | None
    draw_offered_at: datetime | None
    created_at: datetime
    problem_id: uuid.UUID
    problem_slug: str
    problem_title: str
    challenger: DuelPlayerState
    opponent: DuelPlayerState


class DuelFinishResult(BaseModel):
    duel_id: uuid.UUID
    status: DuelStatus
    winner_id: uuid.UUID | None
    challenger_rating_change: int
    opponent_rating_change: int
    challenger_new_rating: int
    opponent_new_rating: int


class DuelRatingHistoryEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    duel_id: uuid.UUID
    rating_before: int
    rating_after: int
    created_at: datetime


class DuelSubmitRequest(BaseModel):
    source_code: str
    language: str


class QueueJoinRequest(BaseModel):
    time_limit_minutes: int = Field(ge=5, le=120)


class QueueEntryRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    time_limit_minutes: int
    joined_at: datetime
    expires_at: datetime
    status: DuelQueueStatus
    matched_duel_id: uuid.UUID | None


class ActiveDuelSummary(BaseModel):
    id: uuid.UUID
    challenger_username: str
    challenger_rating: int
    opponent_username: str
    opponent_rating: int
    problem_title: str
    time_limit_minutes: int
    seconds_elapsed: int


class RecentDuelSummary(BaseModel):
    id: uuid.UUID
    challenger_username: str
    challenger_rating: int
    opponent_username: str
    opponent_rating: int
    winner_username: str | None
    status: DuelStatus
    problem_title: str
    finished_at: datetime


class LobbyResponse(BaseModel):
    queue_counts: dict[int, int]
    active_duels: list[ActiveDuelSummary]
    recent_duels: list[RecentDuelSummary]
    your_queue_entry: QueueEntryRead | None
