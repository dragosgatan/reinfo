import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid

if TYPE_CHECKING:
    from app.models.problem import Problem, TestCase
    from app.models.user import User


class Verdict(StrEnum):
    pending = "pending"
    AC = "AC"
    WA = "WA"
    PARTIAL = "PARTIAL"
    CE = "CE"
    RE = "RE"


# shared enum instance ensures the postgres type is only created once
_VERDICT_ENUM = Enum(Verdict, name="verdict")


class Submission(Base, TimestampMixin):
    __tablename__ = "submissions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    problem_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # fk to contests will be added once that table exists
    contest_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)
    submitted_output_path: Mapped[str] = mapped_column(String(512), nullable=False)
    submitted_code_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    language: Mapped[str | None] = mapped_column(String(32), nullable=True)
    verdict: Mapped[Verdict] = mapped_column(
        _VERDICT_ENUM, nullable=False, server_default=text("'pending'")
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    judged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="submissions")
    problem: Mapped["Problem"] = relationship("Problem", back_populates="submissions")
    results: Mapped[list["SubmissionResult"]] = relationship(
        "SubmissionResult", back_populates="submission", cascade="all, delete-orphan"
    )


class SubmissionResult(Base):
    __tablename__ = "submission_results"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    submission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    test_case_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("test_cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    verdict: Mapped[Verdict] = mapped_column(_VERDICT_ENUM, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    submission: Mapped["Submission"] = relationship("Submission", back_populates="results")
    test_case: Mapped["TestCase"] = relationship("TestCase", back_populates="results")
