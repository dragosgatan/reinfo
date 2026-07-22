"""Project Pydantic schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=128, pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=1, max_length=256)
    brief_md: str = Field(min_length=1)
    class_id: uuid.UUID | None = None
    deadline: datetime | None = None
    published: bool = False


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=256)
    brief_md: str | None = None
    class_id: uuid.UUID | None = None
    deadline: datetime | None = None
    published: bool | None = None


class RepoInfoRead(BaseModel):
    ok: bool
    error_reason: str | None
    language: str | None
    stars: int | None
    last_commit_at: datetime | None
    commit_count_approx: int | None
    readme_md: str | None


class ProjectGradeRead(BaseModel):
    score: int | None
    feedback_md: str | None
    graded_at: datetime
    grader_username: str | None


class ProjectGradeCreate(BaseModel):
    score: int | None = Field(default=None, ge=0, le=100)
    feedback_md: str | None = None


class ProjectSubmissionCreate(BaseModel):
    repo_url: str = Field(min_length=1, max_length=512)
    notes_md: str | None = None


class ProjectSubmissionRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    student_id: uuid.UUID
    student_username: str
    repo_url: str
    notes_md: str | None
    submitted_at: datetime
    last_updated_at: datetime
    grade: ProjectGradeRead | None = None
    repo_info: RepoInfoRead | None = None


class ProjectSubmissionListResponse(BaseModel):
    items: list[ProjectSubmissionRead]
    total: int


class ProjectSummary(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    class_id: uuid.UUID | None
    class_name: str | None
    teacher_id: uuid.UUID | None
    teacher_username: str | None
    deadline: datetime | None
    published: bool
    submission_count: int
    my_submission_id: uuid.UUID | None = None


class ProjectDetail(ProjectSummary):
    brief_md: str
    my_submission: ProjectSubmissionRead | None = None


class ProjectListResponse(BaseModel):
    items: list[ProjectSummary]
    total: int
