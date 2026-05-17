"""Contest, ContestProblem, and ContestParticipant models."""

import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid

if TYPE_CHECKING:
    from app.models.problem import Problem
    from app.models.submission import Submission
    from app.models.user import User


class ScoringMode(StrEnum):
    sum = "sum"
    test = "test"


class ContestType(StrEnum):
    competition = "competition"
    class_test = "class_test"


class Contest(Base, TimestampMixin):
    __tablename__ = "contests"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    slug: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    scoring_mode: Mapped[ScoringMode] = mapped_column(
        Enum(ScoringMode, name="scoringmode"),
        nullable=False,
        server_default=text("'sum'"),
    )
    contest_type: Mapped[ContestType] = mapped_column(
        Enum(ContestType, name="contesttype"),
        nullable=False,
        server_default=text("'competition'"),
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))

    creator: Mapped["User | None"] = relationship("User", back_populates="contests")
    contest_problems: Mapped[list["ContestProblem"]] = relationship(
        "ContestProblem",
        back_populates="contest",
        cascade="all, delete-orphan",
        order_by="ContestProblem.ordinal",
    )
    participants: Mapped[list["ContestParticipant"]] = relationship(
        "ContestParticipant",
        back_populates="contest",
        cascade="all, delete-orphan",
    )
    submissions: Mapped[list["Submission"]] = relationship("Submission", back_populates="contest")
    problems: Mapped[list["Problem"]] = relationship(
        "Problem",
        back_populates="origin_contest",
        foreign_keys="[Problem.origin_contest_id]",
    )


class ContestProblem(Base):
    __tablename__ = "contest_problems"
    __table_args__ = (
        UniqueConstraint("contest_id", "ordinal", name="uq_contest_problems_ordinal"),
    )

    contest_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contests.id", ondelete="CASCADE"), nullable=False, primary_key=True
    )
    problem_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, primary_key=True
    )
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)

    contest: Mapped["Contest"] = relationship("Contest", back_populates="contest_problems")
    problem: Mapped["Problem"] = relationship("Problem", back_populates="contest_problem_entries")


class ContestParticipant(Base):
    __tablename__ = "contest_participants"

    contest_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contests.id", ondelete="CASCADE"), nullable=False, primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, primary_key=True
    )
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    contest: Mapped["Contest"] = relationship("Contest", back_populates="participants")
    user: Mapped["User"] = relationship("User", back_populates="contest_participations")
