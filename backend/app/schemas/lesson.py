"""Lesson schemas."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.lesson import LessonCategory, LessonLevel


class QuizOption(BaseModel):
    text: str


class QuizQuestion(BaseModel):
    id: str
    question: str
    options: list[str] = Field(min_length=2, max_length=6)
    correct: int
    explanation: str = ""


class LessonCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=128, pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=1, max_length=256)
    category: LessonCategory
    level: LessonLevel
    content_md: str = ""
    teacher_notes_md: str | None = None
    quizzes: list[dict[str, Any]] = []
    ordinal: int = Field(default=0, ge=0)
    published: bool = False


class LessonUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=256)
    category: LessonCategory | None = None
    level: LessonLevel | None = None
    content_md: str | None = None
    teacher_notes_md: str | None = None
    quizzes: list[dict[str, Any]] | None = None
    ordinal: int | None = Field(default=None, ge=0)
    published: bool | None = None


class LessonListItem(BaseModel):
    """Compact lesson info for the /invatare index."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    title: str
    category: LessonCategory
    level: LessonLevel
    ordinal: int
    published: bool
    is_completed: bool = False


class LessonRead(BaseModel):
    """Full lesson detail."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    title: str
    category: LessonCategory
    level: LessonLevel
    content_md: str
    teacher_notes_md: str | None
    quizzes: list[dict[str, Any]]
    ordinal: int
    published: bool
    created_at: datetime
    updated_at: datetime
    is_completed: bool = False


class LessonListResponse(BaseModel):
    items: list[LessonListItem]
    total: int


class LessonProgressRead(BaseModel):
    """Completion record."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lesson_id: uuid.UUID
    completed_at: datetime
