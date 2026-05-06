import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.problem import ComparisonMode, Visibility


class ProblemCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=128, pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=1, max_length=256)
    statement_md: str
    input_format: str
    output_format: str
    difficulty: int = Field(ge=1, le=10)
    tags: list[str] = []
    visibility: Visibility = Visibility.draft
    time_limit_ms: int = Field(default=1000, ge=100, le=30000)
    memory_limit_kb: int = Field(default=65536, ge=4096, le=524288)
    score_total: int = Field(default=100, ge=1)
    comparison_mode: ComparisonMode = ComparisonMode.exact
    float_epsilon: float | None = None


class ProblemUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=256)
    statement_md: str | None = None
    input_format: str | None = None
    output_format: str | None = None
    difficulty: int | None = Field(default=None, ge=1, le=10)
    tags: list[str] | None = None
    visibility: Visibility | None = None
    time_limit_ms: int | None = Field(default=None, ge=100, le=30000)
    memory_limit_kb: int | None = Field(default=None, ge=4096, le=524288)
    comparison_mode: ComparisonMode | None = None
    float_epsilon: float | None = None


class ProblemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    title: str
    statement_md: str
    input_format: str
    output_format: str
    difficulty: int
    tags: list[str]
    author_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    visibility: Visibility
    time_limit_ms: int
    memory_limit_kb: int
    score_total: int
    comparison_mode: ComparisonMode
    float_epsilon: float | None


class ProblemSummary(BaseModel):
    """Compact representation for list views."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    title: str
    difficulty: int
    tags: list[str]
    visibility: Visibility
    score_total: int
    created_at: datetime
