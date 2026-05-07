"""initial schema

Revision ID: f3e2d1c0b9a8
Revises:
Create Date: 2026-05-06 12:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "f3e2d1c0b9a8"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- enum types ---
    op.execute("CREATE TYPE userrole AS ENUM ('student', 'teacher', 'admin')")
    op.execute("CREATE TYPE visibility AS ENUM ('public', 'draft', 'private')")
    op.execute(
        "CREATE TYPE comparisonmode AS ENUM "
        "('exact', 'whitespace_insensitive', 'float_epsilon')"
    )
    op.execute(
        "CREATE TYPE verdict AS ENUM ('pending', 'AC', 'WA', 'PARTIAL', 'CE', 'RE')"
    )

    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("username", sa.String(64), nullable=False),
        sa.Column("email", sa.String(256), nullable=False),
        sa.Column("password_hash", sa.String(256), nullable=False),
        sa.Column(
            "role",
            postgresql.ENUM(name="userrole", create_type=False),
            nullable=False,
            server_default="student",
        ),
        sa.Column("display_name", sa.String(128), nullable=False),
        sa.Column("avatar_url", sa.String(512), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "last_active_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "language", sa.String(8), server_default="ro", nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
        sa.UniqueConstraint("email"),
    )

    # --- sessions ---
    op.create_table(
        "sessions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("token", sa.String(256), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])

    # --- problems ---
    op.create_table(
        "problems",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("slug", sa.String(128), nullable=False),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("statement_md", sa.Text(), nullable=False),
        sa.Column("input_format", sa.Text(), nullable=False),
        sa.Column("output_format", sa.Text(), nullable=False),
        sa.Column("difficulty", sa.Integer(), nullable=False),
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("ARRAY[]::varchar[]"),
        ),
        sa.Column("author_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "visibility",
            postgresql.ENUM(name="visibility", create_type=False),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "time_limit_ms", sa.Integer(), nullable=False, server_default="1000"
        ),
        sa.Column(
            "memory_limit_kb", sa.Integer(), nullable=False, server_default="65536"
        ),
        sa.Column(
            "score_total", sa.Integer(), nullable=False, server_default="100"
        ),
        sa.Column(
            "comparison_mode",
            postgresql.ENUM(name="comparisonmode", create_type=False),
            nullable=False,
            server_default="exact",
        ),
        sa.Column("float_epsilon", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(
            ["author_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_problems_author_id", "problems", ["author_id"])

    # --- test_cases ---
    op.create_table(
        "test_cases",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("problem_id", sa.UUID(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("input_path", sa.String(512), nullable=False),
        sa.Column("output_path", sa.String(512), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False, server_default="10"),
        sa.Column(
            "is_sample", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column(
            "is_hidden", sa.Boolean(), nullable=False, server_default="true"
        ),
        sa.ForeignKeyConstraint(
            ["problem_id"], ["problems.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_test_cases_problem_id", "test_cases", ["problem_id"])

    # --- submissions ---
    op.create_table(
        "submissions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("problem_id", sa.UUID(), nullable=False),
        sa.Column("contest_id", sa.UUID(), nullable=True),
        sa.Column("submitted_output_path", sa.String(512), nullable=False),
        sa.Column("submitted_code_path", sa.String(512), nullable=True),
        sa.Column("language", sa.String(32), nullable=True),
        sa.Column(
            "verdict",
            postgresql.ENUM(name="verdict", create_type=False),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("judged_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["problem_id"], ["problems.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_submissions_user_id", "submissions", ["user_id"])
    op.create_index("ix_submissions_problem_id", "submissions", ["problem_id"])
    op.create_index("ix_submissions_contest_id", "submissions", ["contest_id"])

    # --- submission_results ---
    op.create_table(
        "submission_results",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("submission_id", sa.UUID(), nullable=False),
        sa.Column("test_case_id", sa.UUID(), nullable=False),
        sa.Column(
            "verdict",
            postgresql.ENUM(name="verdict", create_type=False),
            nullable=False,
        ),
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("message", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["submission_id"], ["submissions.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["test_case_id"], ["test_cases.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_submission_results_submission_id",
        "submission_results",
        ["submission_id"],
    )
    op.create_index(
        "ix_submission_results_test_case_id",
        "submission_results",
        ["test_case_id"],
    )


def downgrade() -> None:
    op.drop_table("submission_results")
    op.drop_table("submissions")
    op.drop_table("test_cases")
    op.drop_table("problems")
    op.drop_table("sessions")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS verdict")
    op.execute("DROP TYPE IF EXISTS comparisonmode")
    op.execute("DROP TYPE IF EXISTS visibility")
    op.execute("DROP TYPE IF EXISTS userrole")
