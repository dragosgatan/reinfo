import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid

if TYPE_CHECKING:
    from app.models.problem import Problem
    from app.models.user import User


class DuelStatus(StrEnum):
    pending = "pending"
    active = "active"
    resigned = "resigned"
    drawn = "drawn"
    finished = "finished"


class DuelRequestStatus(StrEnum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    expired = "expired"


class Duel(Base, TimestampMixin):
    __tablename__ = "duels"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    challenger_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    opponent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    problem_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("problems.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[DuelStatus] = mapped_column(
        Enum(DuelStatus, name="duelstatus"),
        nullable=False,
        server_default=text("'pending'"),
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    winner_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    time_limit_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    challenger_score: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    opponent_score: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    draw_offered_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    draw_offered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    challenger: Mapped["User"] = relationship("User", foreign_keys=[challenger_id])
    opponent: Mapped["User"] = relationship("User", foreign_keys=[opponent_id])
    winner: Mapped["User | None"] = relationship("User", foreign_keys=[winner_id])
    problem: Mapped["Problem"] = relationship("Problem")
    rating_history: Mapped[list["DuelRatingHistory"]] = relationship(
        "DuelRatingHistory", back_populates="duel", cascade="all, delete-orphan"
    )


class DuelRequest(Base, TimestampMixin):
    __tablename__ = "duel_requests"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    from_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    to_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    time_limit_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    difficulty_min: Mapped[int] = mapped_column(Integer, nullable=False)
    difficulty_max: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[DuelRequestStatus] = mapped_column(
        Enum(DuelRequestStatus, name="duelrequeststatus"),
        nullable=False,
        server_default=text("'pending'"),
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    sender: Mapped["User"] = relationship("User", foreign_keys=[from_id])
    recipient: Mapped["User"] = relationship("User", foreign_keys=[to_id])


class DuelQueueStatus(StrEnum):
    waiting = "waiting"
    matched = "matched"
    cancelled = "cancelled"


class DuelQueue(Base):
    __tablename__ = "duel_queue"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    time_limit_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[DuelQueueStatus] = mapped_column(
        Enum(DuelQueueStatus, name="duelqueuestatus"),
        nullable=False,
        server_default=text("'waiting'"),
    )
    matched_duel_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("duels.id", ondelete="SET NULL"), nullable=True
    )

    user: Mapped["User"] = relationship("User")
    matched_duel: Mapped["Duel | None"] = relationship("Duel")


class DuelRatingHistory(Base, TimestampMixin):
    __tablename__ = "duel_rating_history"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    duel_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("duels.id", ondelete="CASCADE"), nullable=False
    )
    rating_before: Mapped[int] = mapped_column(Integer, nullable=False)
    rating_after: Mapped[int] = mapped_column(Integer, nullable=False)

    duel: Mapped["Duel"] = relationship("Duel", back_populates="rating_history")
