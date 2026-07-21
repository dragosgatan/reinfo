import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid

if TYPE_CHECKING:
    from app.models.contest import Contest, ContestProblem
    from app.models.submission import Submission, SubmissionResult
    from app.models.user import User


class Visibility(StrEnum):
    public = "public"
    draft = "draft"
    private = "private"
    contest = "contest"


class ComparisonMode(StrEnum):
    exact = "exact"
    whitespace_insensitive = "whitespace_insensitive"
    float_epsilon = "float_epsilon"


class ProblemType(StrEnum):
    standard = "standard"
    quiz = "quiz"
    dataset = "dataset"


class Problem(Base, TimestampMixin):
    __tablename__ = "problems"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    slug: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    statement_md: Mapped[str] = mapped_column(Text, nullable=False)
    statement_md_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    statement_md_hu: Mapped[str | None] = mapped_column(Text, nullable=True)
    input_format: Mapped[str] = mapped_column(Text, nullable=False)
    output_format: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String(64)), nullable=False, server_default=text("ARRAY[]::varchar[]")
    )
    # nullable so problems survive author account deletion
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    visibility: Mapped[Visibility] = mapped_column(
        Enum(Visibility, name="visibility"),
        nullable=False,
        server_default=text("'draft'"),
    )
    time_limit_ms: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1000"))
    memory_limit_kb: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("65536")
    )
    score_total: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("100"))
    comparison_mode: Mapped[ComparisonMode] = mapped_column(
        Enum(ComparisonMode, name="comparisonmode"),
        nullable=False,
        server_default=text("'whitespace_insensitive'"),
    )
    float_epsilon: Mapped[float | None] = mapped_column(Float, nullable=True)
    # null for standalone problems; set when created as part of a contest
    origin_contest_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("contests.id", ondelete="SET NULL"), nullable=True, index=True
    )
    problem_type: Mapped[ProblemType] = mapped_column(
        Enum(ProblemType, name="problemtype"),
        nullable=False,
        server_default=text("'standard'"),
    )

    author: Mapped["User | None"] = relationship("User", back_populates="problems")
    test_cases: Mapped[list["TestCase"]] = relationship(
        "TestCase",
        back_populates="problem",
        cascade="all, delete-orphan",
        order_by="TestCase.ordinal",
    )
    quiz_options: Mapped[list["QuizOption"]] = relationship(
        "QuizOption",
        back_populates="problem",
        cascade="all, delete-orphan",
        order_by="QuizOption.ordinal",
    )
    submissions: Mapped[list["Submission"]] = relationship("Submission", back_populates="problem")
    origin_contest: Mapped["Contest | None"] = relationship(
        "Contest",
        back_populates="problems",
        foreign_keys=[origin_contest_id],
    )
    contest_problem_entries: Mapped[list["ContestProblem"]] = relationship(
        "ContestProblem", back_populates="problem"
    )


class TestCase(Base):
    __tablename__ = "test_cases"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    problem_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    input_path: Mapped[str] = mapped_column(String(512), nullable=False)
    output_path: Mapped[str] = mapped_column(String(512), nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("10"))
    is_sample: Mapped[bool] = mapped_column(nullable=False, server_default=text("false"))
    is_hidden: Mapped[bool] = mapped_column(nullable=False, server_default=text("true"))

    problem: Mapped["Problem"] = relationship("Problem", back_populates="test_cases")
    results: Mapped[list["SubmissionResult"]] = relationship(
        "SubmissionResult", back_populates="test_case"
    )


class QuizOption(Base):
    __tablename__ = "quiz_options"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    problem_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    text_md: Mapped[str] = mapped_column(Text, nullable=False)
    text_md_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    explanation_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    explanation_md_en: Mapped[str | None] = mapped_column(Text, nullable=True)

    problem: Mapped["Problem"] = relationship("Problem", back_populates="quiz_options")
