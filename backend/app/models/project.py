"""project, projectsubmission, projectgrade, and githubrepocache models; students submit a github repo link and can resubmit until the deadline"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid

if TYPE_CHECKING:
    from app.models.classroom import Class
    from app.models.user import User


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    slug: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    brief_md: Mapped[str] = mapped_column(Text, nullable=False)
    class_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("classes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))

    cls: Mapped["Class | None"] = relationship("Class")
    teacher: Mapped["User | None"] = relationship("User")
    submissions: Mapped[list["ProjectSubmission"]] = relationship(
        "ProjectSubmission", back_populates="project", cascade="all, delete-orphan"
    )


class ProjectSubmission(Base):
    __tablename__ = "project_submissions"
    __table_args__ = (
        UniqueConstraint("project_id", "student_id", name="uq_project_submission_student"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    repo_url: Mapped[str] = mapped_column(String(512), nullable=False)
    notes_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    last_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    project: Mapped["Project"] = relationship("Project", back_populates="submissions")
    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])
    grade: Mapped["ProjectGrade | None"] = relationship(
        "ProjectGrade", back_populates="submission", cascade="all, delete-orphan", uselist=False
    )


class ProjectGrade(Base):
    __tablename__ = "project_grades"
    __table_args__ = (UniqueConstraint("submission_id", name="uq_project_grade_submission"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    submission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("project_submissions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    grader_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    feedback_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    graded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    submission: Mapped["ProjectSubmission"] = relationship(
        "ProjectSubmission", back_populates="grade"
    )
    grader: Mapped["User | None"] = relationship("User", foreign_keys=[grader_id])


class GithubRepoCache(Base):
    """cached public repo metadata for the optional enable_github_integration feature, no tokens stored"""

    __tablename__ = "github_repo_cache"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    repo_url: Mapped[str] = mapped_column(String(512), unique=True, nullable=False, index=True)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    ok: Mapped[bool] = mapped_column(Boolean, nullable=False)
    language: Mapped[str | None] = mapped_column(String(64), nullable=True)
    stars: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_commit_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    commit_count_approx: Mapped[int | None] = mapped_column(Integer, nullable=True)
    readme_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
