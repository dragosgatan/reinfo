import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid

if TYPE_CHECKING:
    from app.models.contest import Contest, ContestParticipant
    from app.models.problem import Problem
    from app.models.submission import Submission


class UserRole(StrEnum):
    student = "student"
    teacher = "teacher"
    admin = "admin"
    superuser = "superuser"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="userrole"),
        nullable=False,
        server_default=text("'student'"),
    )
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_active_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    language: Mapped[str] = mapped_column(String(8), server_default=text("'ro'"), nullable=False)
    theme: Mapped[str | None] = mapped_column(String(32), nullable=True)
    duel_rating: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("800"))
    duel_wins: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    duel_losses: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    duel_draws: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    contest_rating: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("1500")
    )
    is_banned: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    privacy_show_email: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    privacy_show_activity: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    privacy_show_solved: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    github_url: Mapped[str | None] = mapped_column(String(256), nullable=True)
    link_1: Mapped[str | None] = mapped_column(String(256), nullable=True)
    link_2: Mapped[str | None] = mapped_column(String(256), nullable=True)
    link_3: Mapped[str | None] = mapped_column(String(256), nullable=True)

    sessions: Mapped[list["Session"]] = relationship(
        "Session", back_populates="user", cascade="all, delete-orphan"
    )
    problems: Mapped[list["Problem"]] = relationship("Problem", back_populates="author")
    submissions: Mapped[list["Submission"]] = relationship("Submission", back_populates="user")
    contests: Mapped[list["Contest"]] = relationship("Contest", back_populates="creator")
    contest_participations: Mapped[list["ContestParticipant"]] = relationship(
        "ContestParticipant", back_populates="user"
    )
    external_results: Mapped[list["ExternalResult"]] = relationship(
        "ExternalResult",
        foreign_keys="ExternalResult.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class ExternalResult(Base, TimestampMixin):
    __tablename__ = "external_results"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    contest_name: Mapped[str] = mapped_column(String(256), nullable=False)
    platform: Mapped[str] = mapped_column(String(128), nullable=False)
    result_text: Mapped[str] = mapped_column(String(256), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    verified_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    user: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], back_populates="external_results"
    )
    verified_by: Mapped["User | None"] = relationship("User", foreign_keys=[verified_by_id])


class Session(Base, TimestampMixin):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token: Mapped[str] = mapped_column(String(256), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="sessions")


class PasswordResetToken(Base, TimestampMixin):
    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token: Mapped[str] = mapped_column(String(256), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User")
