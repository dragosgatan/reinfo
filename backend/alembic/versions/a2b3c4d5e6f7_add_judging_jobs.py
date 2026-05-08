"""add judging_jobs queue table

Revision ID: a2b3c4d5e6f7
Revises: f3e2d1c0b9a8
Create Date: 2026-05-08 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "a2b3c4d5e6f7"
down_revision: str | None = "f3e2d1c0b9a8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE TYPE jobstatus AS ENUM ('queued', 'running', 'done', 'failed')")

    op.create_table(
        "judging_jobs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("submission_id", sa.UUID(), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(name="jobstatus", create_type=False),
            nullable=False,
            server_default="queued",
        ),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("submission_id"),
    )
    op.create_index("ix_judging_jobs_submission_id", "judging_jobs", ["submission_id"])
    op.create_index(
        "ix_judging_jobs_status_created_at",
        "judging_jobs",
        ["status", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("judging_jobs")
    op.execute("DROP TYPE IF EXISTS jobstatus")
