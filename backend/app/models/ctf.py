"""ctf challenge models: challenges, attachments, solves, flag attempts, hints"""

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
    from app.models.user import User


class CtfCategory(StrEnum):
    web = "web"
    crypto = "crypto"
    pwn = "pwn"
    reverse = "reverse"
    forensics = "forensics"
    osint = "osint"
    misc = "misc"


class CtfScoring(StrEnum):
    static = "static"
    dynamic = "dynamic"


class CtfChallenge(Base, TimestampMixin):
    __tablename__ = "ctf_challenges"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    slug: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    statement_md: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[CtfCategory] = mapped_column(
        Enum(CtfCategory, name="ctfcategory"), nullable=False
    )
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)
    base_points: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("100"))
    scoring: Mapped[CtfScoring] = mapped_column(
        Enum(CtfScoring, name="ctfscoring"), nullable=False, server_default=text("'static'")
    )
    # bcrypt hash only - the plaintext flag is never persisted anywhere
    flag_hash: Mapped[str] = mapped_column(Text, nullable=False)
    flag_case_sensitive: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    published: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    author: Mapped["User | None"] = relationship("User")
    attachments: Mapped[list["CtfAttachment"]] = relationship(
        "CtfAttachment", back_populates="challenge", cascade="all, delete-orphan"
    )
    hints: Mapped[list["CtfHint"]] = relationship(
        "CtfHint",
        back_populates="challenge",
        cascade="all, delete-orphan",
        order_by="CtfHint.ordinal",
    )
    solves: Mapped[list["CtfSolve"]] = relationship(
        "CtfSolve", back_populates="challenge", cascade="all, delete-orphan"
    )
    flag_attempts: Mapped[list["CtfFlagAttempt"]] = relationship(
        "CtfFlagAttempt", back_populates="challenge", cascade="all, delete-orphan"
    )


class CtfAttachment(Base):
    __tablename__ = "ctf_attachments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ctf_challenges.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(256), nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False)

    challenge: Mapped["CtfChallenge"] = relationship("CtfChallenge", back_populates="attachments")


class CtfSolve(Base):
    __tablename__ = "ctf_solves"
    __table_args__ = (
        UniqueConstraint("challenge_id", "user_id", name="uq_ctf_solves_challenge_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ctf_challenges.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    solved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    points_awarded: Mapped[int] = mapped_column(Integer, nullable=False)

    challenge: Mapped["CtfChallenge"] = relationship("CtfChallenge", back_populates="solves")
    user: Mapped["User"] = relationship("User")


class CtfFlagAttempt(Base):
    __tablename__ = "ctf_flag_attempts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ctf_challenges.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    correct: Mapped[bool] = mapped_column(Boolean, nullable=False)

    challenge: Mapped["CtfChallenge"] = relationship("CtfChallenge", back_populates="flag_attempts")
    user: Mapped["User"] = relationship("User")


class CtfHint(Base):
    __tablename__ = "ctf_hints"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ctf_challenges.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    content_md: Mapped[str] = mapped_column(Text, nullable=False)
    cost: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    challenge: Mapped["CtfChallenge"] = relationship("CtfChallenge", back_populates="hints")


class CtfHintReveal(Base):
    """tracks which user revealed which hint, needed to charge the cost once per user"""

    __tablename__ = "ctf_hint_reveals"
    __table_args__ = (UniqueConstraint("hint_id", "user_id", name="uq_ctf_hint_reveals_hint_user"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    hint_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ctf_hints.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    revealed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    hint: Mapped["CtfHint"] = relationship("CtfHint")
    user: Mapped["User"] = relationship("User")
