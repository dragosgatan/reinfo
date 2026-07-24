"""track, trackitem, and trackprogress models for multi-olympiad preparation tracks; a simple linear checklist, unlike the freeform roadmap graph"""

import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid

if TYPE_CHECKING:
    from app.models.user import User


class TrackOlympiad(StrEnum):
    ONI = "ONI"
    ONIA = "ONIA"
    ONSC = "ONSC"
    IOAI = "IOAI"
    CTF = "CTF"
    Linux = "Linux"
    other = "other"


class TrackAudience(StrEnum):
    scoala = "scoala"
    job = "job"
    certificare = "certificare"


class TrackItemType(StrEnum):
    lesson = "lesson"
    problem = "problem"
    ctf_challenge = "ctf_challenge"


class TrackItemStatus(StrEnum):
    not_started = "not_started"
    in_progress = "in_progress"
    done = "done"


class Track(Base, TimestampMixin):
    __tablename__ = "tracks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    slug: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    olympiad: Mapped[TrackOlympiad] = mapped_column(
        Enum(TrackOlympiad, name="track_olympiad"), nullable=False
    )
    audience: Mapped[TrackAudience] = mapped_column(
        Enum(TrackAudience, name="track_audience"),
        nullable=False,
        server_default=text("'scoala'"),
        index=True,
    )
    description_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    published: Mapped[bool] = mapped_column(nullable=False, server_default=text("false"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    items: Mapped[list["TrackItem"]] = relationship(
        "TrackItem",
        back_populates="track",
        cascade="all, delete-orphan",
        order_by="TrackItem.order",
    )


class TrackItem(Base):
    __tablename__ = "track_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    track_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_type: Mapped[TrackItemType] = mapped_column(
        Enum(TrackItemType, name="track_item_type"), nullable=False
    )
    # Polymorphic reference to lessons/problems/ctf_challenges.id - no DB-level FK
    # since the target table depends on item_type; existence is validated in the router.
    ref_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    prerequisite_item_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("track_items.id", ondelete="SET NULL"), nullable=True, index=True
    )

    track: Mapped["Track"] = relationship("Track", back_populates="items")
    prerequisite: Mapped["TrackItem | None"] = relationship(
        "TrackItem", remote_side="TrackItem.id", foreign_keys=[prerequisite_item_id]
    )
    progress: Mapped[list["TrackProgress"]] = relationship(
        "TrackProgress", back_populates="item", cascade="all, delete-orphan"
    )


class TrackProgress(Base):
    __tablename__ = "track_progress"
    __table_args__ = (UniqueConstraint("user_id", "item_id", name="uq_track_progress_user_item"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("track_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[TrackItemStatus] = mapped_column(
        Enum(TrackItemStatus, name="track_item_status"),
        nullable=False,
        server_default=text("'not_started'"),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User")
    item: Mapped["TrackItem"] = relationship("TrackItem", back_populates="progress")
