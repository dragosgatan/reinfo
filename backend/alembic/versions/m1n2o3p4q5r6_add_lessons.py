"""add lessons and lesson_progress tables

Revision ID: m1n2o3p4q5r6
Revises: l0m1n2o3p4q5
Create Date: 2026-05-18
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "m1n2o3p4q5r6"
down_revision = "l0m1n2o3p4q5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "CREATE TYPE lessoncategory AS ENUM ('basics', 'data_structures', 'graphs', 'dp', 'math')"
    )
    op.execute("CREATE TYPE lessonlevel AS ENUM ('beginner', 'intermediate', 'advanced')")

    op.create_table(
        "lessons",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("slug", sa.String(128), nullable=False),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column(
            "category",
            postgresql.ENUM(
                "basics",
                "data_structures",
                "graphs",
                "dp",
                "math",
                name="lessoncategory",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "level",
            postgresql.ENUM(
                "beginner", "intermediate", "advanced", name="lessonlevel", create_type=False
            ),
            nullable=False,
        ),
        sa.Column("content_md", sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.Column("teacher_notes_md", sa.Text(), nullable=True),
        sa.Column("quizzes", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("ordinal", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("published", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )

    op.create_table(
        "lesson_progress",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("lesson_id", sa.UUID(), nullable=False),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "lesson_id", name="uq_lesson_progress"),
    )
    op.create_index("ix_lesson_progress_user_id", "lesson_progress", ["user_id"])
    op.create_index("ix_lesson_progress_lesson_id", "lesson_progress", ["lesson_id"])


def downgrade() -> None:
    op.drop_table("lesson_progress")
    op.drop_table("lessons")
    op.execute("DROP TYPE IF EXISTS lessoncategory")
    op.execute("DROP TYPE IF EXISTS lessonlevel")
