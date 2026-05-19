"""Schemas for the classroom feature."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ClassCreate(BaseModel):
    name: str = Field(min_length=1, max_length=256)
    description_md: str | None = Field(default=None, max_length=8000)


class ClassUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=256)
    description_md: str | None = None
    archived: bool | None = None


class MemberRead(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str
    avatar_url: str | None


class ClassRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description_md: str | None
    join_code: str
    archived: bool
    created_at: datetime
    teacher_id: uuid.UUID
    teacher_username: str
    teacher_display_name: str
    teacher_avatar_url: str | None
    member_count: int


class ClassDetail(ClassRead):
    members: list[MemberRead]


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    body_md: str = Field(min_length=1, max_length=16000)


class AnnouncementUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=256)
    body_md: str | None = Field(default=None, min_length=1, max_length=16000)
    pinned: bool | None = None


class AnnouncementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    class_id: uuid.UUID
    author_id: uuid.UUID
    author_username: str
    author_display_name: str
    author_avatar_url: str | None
    title: str
    body_md: str
    pinned: bool
    created_at: datetime


class AssignmentCreate(BaseModel):
    problem_slug: str
    note_md: str | None = Field(default=None, max_length=4000)
    due_at: datetime | None = None


class AssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    class_id: uuid.UUID
    homework_id: uuid.UUID | None
    problem_id: uuid.UUID
    problem_slug: str
    problem_title: str
    problem_difficulty: int
    note_md: str | None
    due_at: datetime | None
    created_at: datetime
    user_solved: bool


class HomeworkCreate(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    description_md: str | None = Field(default=None, max_length=8000)
    due_at: datetime | None = None
    problem_slugs: list[str] = Field(min_length=1)


class HomeworkUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=256)
    description_md: str | None = None
    due_at: datetime | None = None


class HomeworkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    class_id: uuid.UUID
    title: str
    description_md: str | None
    due_at: datetime | None
    created_at: datetime
    assignments: list[AssignmentRead]


class StudentProgress(BaseModel):
    student_id: uuid.UUID
    student_username: str
    student_display_name: str
    student_avatar_url: str | None
    solved_problem_ids: list[uuid.UUID]


class HomeworkProgress(BaseModel):
    homework: HomeworkRead
    members: list[StudentProgress]


class ClassMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    class_id: uuid.UUID
    author_id: uuid.UUID
    author_username: str
    author_display_name: str
    author_avatar_url: str | None
    body: str
    created_at: datetime


class ClassMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class DirectMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    class_id: uuid.UUID
    sender_id: uuid.UUID
    sender_username: str
    sender_display_name: str
    sender_avatar_url: str | None
    receiver_id: uuid.UUID
    body: str
    read: bool
    created_at: datetime


class DirectMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class DmThreadUnread(BaseModel):
    class_id: uuid.UUID
    other_username: str
    unread_count: int


class ClassTestCreate(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    description_md: str | None = Field(default=None, max_length=8000)
    start_time: datetime
    end_time: datetime
    fullscreen_required: bool = False
    copy_paste_blocked: bool = False

    @model_validator(mode="after")
    def _end_after_start(self) -> "ClassTestCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time trebuie să fie după start_time")
        return self


class ClassTestRead(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    description_md: str | None
    start_time: datetime
    end_time: datetime
    status: str
    problem_count: int
    participant_count: int
    fullscreen_required: bool
    copy_paste_blocked: bool
