"""add projects, project_submissions, project_grades, github_repo_cache

Revision ID: b8c9d0e1f2g3
Revises: a7b8c9d0e1f2
Create Date: 2026-07-22

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "b8c9d0e1f2g3"
down_revision: str | None = "a7b8c9d0e1f2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("slug", sa.String(128), nullable=False),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("brief_md", sa.Text(), nullable=False),
        sa.Column("class_id", sa.UUID(), nullable=True),
        sa.Column("teacher_id", sa.UUID(), nullable=True),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_projects_slug", "projects", ["slug"])
    op.create_index("ix_projects_class_id", "projects", ["class_id"])
    op.create_index("ix_projects_teacher_id", "projects", ["teacher_id"])

    op.create_table(
        "project_submissions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("repo_url", sa.String(512), nullable=False),
        sa.Column("notes_md", sa.Text(), nullable=True),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "last_updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "student_id", name="uq_project_submission_student"),
    )
    op.create_index("ix_project_submissions_project_id", "project_submissions", ["project_id"])
    op.create_index("ix_project_submissions_student_id", "project_submissions", ["student_id"])

    op.create_table(
        "project_grades",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("submission_id", sa.UUID(), nullable=False),
        sa.Column("grader_id", sa.UUID(), nullable=True),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("feedback_md", sa.Text(), nullable=True),
        sa.Column(
            "graded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["submission_id"], ["project_submissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["grader_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("submission_id", name="uq_project_grade_submission"),
    )
    op.create_index("ix_project_grades_submission_id", "project_grades", ["submission_id"])

    op.create_table(
        "github_repo_cache",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("repo_url", sa.String(512), nullable=False),
        sa.Column(
            "fetched_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("ok", sa.Boolean(), nullable=False),
        sa.Column("language", sa.String(64), nullable=True),
        sa.Column("stars", sa.Integer(), nullable=True),
        sa.Column("last_commit_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("commit_count_approx", sa.Integer(), nullable=True),
        sa.Column("readme_md", sa.Text(), nullable=True),
        sa.Column("error_reason", sa.String(64), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("repo_url"),
    )
    op.create_index("ix_github_repo_cache_repo_url", "github_repo_cache", ["repo_url"])


def downgrade() -> None:
    op.drop_table("github_repo_cache")
    op.drop_table("project_grades")
    op.drop_table("project_submissions")
    op.drop_table("projects")
