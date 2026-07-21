import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid

if TYPE_CHECKING:
    from app.models.contest import Contest
    from app.models.duel import Duel
    from app.models.problem import Problem, TestCase
    from app.models.user import User


class Verdict(StrEnum):
    pending = "pending"
    AC = "AC"
    WA = "WA"
    PARTIAL = "PARTIAL"
    CE = "CE"
    RE = "RE"
    TLE = "TLE"
    MLE = "MLE"
    INVALID_FORMAT = "INVALID_FORMAT"


class SubmissionKind(StrEnum):
    code = "code"
    dataset = "dataset"


# shared enum instance ensures the postgres type is only created once
_VERDICT_ENUM = Enum(Verdict, name="verdict")
_SUBMISSION_KIND_ENUM = Enum(SubmissionKind, name="submissionkind")


class Submission(Base, TimestampMixin):
    __tablename__ = "submissions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    problem_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True
    )
    contest_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("contests.id", ondelete="SET NULL"), nullable=True, index=True
    )
    duel_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("duels.id", ondelete="SET NULL"), nullable=True, index=True
    )
    submitted_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String(32), nullable=False)
    verdict: Mapped[Verdict] = mapped_column(
        _VERDICT_ENUM, nullable=False, server_default=text("'pending'")
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    judged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    flag_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    submission_kind: Mapped[SubmissionKind] = mapped_column(
        _SUBMISSION_KIND_ENUM, nullable=False, server_default=text("'code'")
    )
    manual_review: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    dataset_csv_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="submissions")
    problem: Mapped["Problem"] = relationship("Problem", back_populates="submissions")
    contest: Mapped["Contest | None"] = relationship("Contest", back_populates="submissions")
    duel: Mapped["Duel | None"] = relationship("Duel")
    results: Mapped[list["SubmissionResult"]] = relationship(
        "SubmissionResult", back_populates="submission", cascade="all, delete-orphan"
    )


class SubmissionResult(Base):
    __tablename__ = "submission_results"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    submission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    test_case_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("test_cases.id", ondelete="CASCADE"), nullable=True, index=True
    )
    verdict: Mapped[Verdict] = mapped_column(_VERDICT_ENUM, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    actual_output: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_output_snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    execution_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    memory_kb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metric_value: Mapped[float | None] = mapped_column(Float, nullable=True)

    submission: Mapped["Submission"] = relationship("Submission", back_populates="results")
    test_case: Mapped["TestCase | None"] = relationship("TestCase", back_populates="results")
