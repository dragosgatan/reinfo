import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.ctf import CtfCategory, CtfScoring


class CtfChallengeCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=128, pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=1, max_length=256)
    statement_md: str
    category: CtfCategory
    difficulty: int = Field(ge=1, le=10)
    base_points: int = Field(default=100, ge=1)
    scoring: CtfScoring = CtfScoring.static
    flag: str = Field(min_length=1, max_length=256)
    flag_case_sensitive: bool = True
    published: bool = False


class CtfChallengeUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=256)
    statement_md: str | None = None
    category: CtfCategory | None = None
    difficulty: int | None = Field(default=None, ge=1, le=10)
    base_points: int | None = Field(default=None, ge=1)
    scoring: CtfScoring | None = None
    flag: str | None = Field(default=None, min_length=1, max_length=256)
    flag_case_sensitive: bool | None = None
    published: bool | None = None


class CtfAttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str


class CtfHintRead(BaseModel):
    id: uuid.UUID
    ordinal: int
    cost: int
    revealed: bool
    content_md: str | None = None


class CtfHintCreate(BaseModel):
    content_md: str = Field(min_length=1)
    cost: int = Field(default=0, ge=0)
    ordinal: int = 0


class CtfChallengeSummary(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    category: CtfCategory
    difficulty: int
    scoring: CtfScoring
    base_points: int
    current_points: int
    solve_count: int
    published: bool
    solved_by_user: bool | None = None
    first_blood_username: str | None = None
    created_at: datetime


class CtfChallengeListResponse(BaseModel):
    items: list[CtfChallengeSummary]
    total: int
    page: int
    per_page: int
    pages: int


class CtfChallengeDetail(CtfChallengeSummary):
    statement_md: str
    flag_case_sensitive: bool
    attachments: list[CtfAttachmentRead]
    hints: list[CtfHintRead]


class CtfFlagSubmitRequest(BaseModel):
    flag: str = Field(min_length=1, max_length=256)


class CtfFlagSubmitResult(BaseModel):
    correct: bool
    already_solved: bool
    first_blood: bool
    points_awarded: int | None = None
    message: str
