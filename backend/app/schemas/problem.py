import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from app.models.problem import ComparisonMode, ProblemType, Visibility


class QuizOptionRead(BaseModel):
    """Quiz option as shown to users before answering — no answers revealed."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ordinal: int
    text_md: str
    text_md_en: str | None


class QuizOptionWithAnswer(BaseModel):
    """Quiz option returned after an attempt — includes correct flag and explanation."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ordinal: int
    text_md: str
    text_md_en: str | None
    is_correct: bool
    explanation_md: str | None
    explanation_md_en: str | None


class QuizOptionCreate(BaseModel):
    ordinal: int
    text_md: str = Field(min_length=1)
    text_md_en: str | None = None
    is_correct: bool = False
    explanation_md: str | None = None
    explanation_md_en: str | None = None


class QuizAttemptRequest(BaseModel):
    selected_option_ids: list[uuid.UUID]


class QuizAttemptResult(BaseModel):
    correct: bool
    options: list[QuizOptionWithAnswer]


class ProblemCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=128, pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=1, max_length=256)
    statement_md: str
    statement_md_en: str | None = None
    input_format: str = ""
    output_format: str = ""
    difficulty: int = Field(ge=1, le=10)
    tags: list[str] = []
    visibility: Visibility = Visibility.draft
    time_limit_ms: int = Field(default=1000, ge=100, le=30000)
    memory_limit_kb: int = Field(default=65536, ge=4096, le=524288)
    score_total: int = Field(default=100, ge=1)
    comparison_mode: ComparisonMode = ComparisonMode.exact
    float_epsilon: float | None = None
    problem_type: ProblemType = ProblemType.standard


class ProblemUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=256)
    statement_md: str | None = None
    statement_md_en: str | None = None
    input_format: str | None = None
    output_format: str | None = None
    difficulty: int | None = Field(default=None, ge=1, le=10)
    tags: list[str] | None = None
    visibility: Visibility | None = None
    time_limit_ms: int | None = Field(default=None, ge=100, le=30000)
    memory_limit_kb: int | None = Field(default=None, ge=4096, le=524288)
    comparison_mode: ComparisonMode | None = None
    float_epsilon: float | None = None
    problem_type: ProblemType | None = None


class ProblemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    title: str
    statement_md: str
    statement_md_en: str | None
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
    problem_type: ProblemType


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


class UserProblemStatus(StrEnum):
    solved = "solved"
    attempted = "attempted"
    unsolved = "unsolved"


class TestCaseSummary(BaseModel):
    """Minimal test case info included in problem detail (sample tests only)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ordinal: int
    score: int
    is_sample: bool


class TestCaseRead(BaseModel):
    """Full test case representation returned after upload."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ordinal: int
    score: int
    is_sample: bool
    is_hidden: bool
    input_path: str
    output_path: str


class ProblemListItem(BaseModel):
    """One row in the paginated problem list."""

    id: uuid.UUID
    slug: str
    title: str
    difficulty: int
    tags: list[str]
    solve_count: int
    user_status: UserProblemStatus | None
    problem_type: ProblemType


class ProblemListResponse(BaseModel):
    items: list[ProblemListItem]
    total: int
    page: int
    per_page: int
    pages: int


class OriginContest(BaseModel):
    slug: str
    title: str


class ProblemDetail(BaseModel):
    """Full problem detail including sample test cases and solve count."""

    id: uuid.UUID
    slug: str
    title: str
    statement_md: str
    statement_md_en: str | None
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
    problem_type: ProblemType
    solve_count: int
    sample_test_cases: list[TestCaseSummary]
    quiz_options: list[QuizOptionRead] = []
    origin_contest: OriginContest | None = None
