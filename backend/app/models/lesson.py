"""lesson and lesson-progress models"""

import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any

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
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid

if TYPE_CHECKING:
    from app.models.user import User


class LessonCategory(StrEnum):
    basics = "basics"
    data_structures = "data_structures"
    graphs = "graphs"
    dp = "dp"
    math = "math"


class LessonLevel(StrEnum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class Lesson(Base, TimestampMixin):
    __tablename__ = "lessons"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    slug: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    category: Mapped[LessonCategory] = mapped_column(
        Enum(LessonCategory, name="lessoncategory"), nullable=False
    )
    level: Mapped[LessonLevel] = mapped_column(
        Enum(LessonLevel, name="lessonlevel"), nullable=False
    )
    content_md: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    content_md_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_md_hu: Mapped[str | None] = mapped_column(Text, nullable=True)
    teacher_notes_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    quizzes: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    published: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    progress: Mapped[list["LessonProgress"]] = relationship(
        "LessonProgress", back_populates="lesson", cascade="all, delete-orphan"
    )


class LessonProgress(Base):
    __tablename__ = "lesson_progress"
    __table_args__ = (UniqueConstraint("user_id", "lesson_id", name="uq_lesson_progress"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    lesson: Mapped["Lesson"] = relationship("Lesson", back_populates="progress")
    user: Mapped["User"] = relationship("User")
