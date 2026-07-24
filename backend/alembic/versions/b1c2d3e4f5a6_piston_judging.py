"""switch to piston code-execution judging

Revision ID: b1c2d3e4f5a6
Revises: a2b3c4d5e6f7
Create Date: 2026-05-16 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "b1c2d3e4f5a6"
down_revision: str | None = "a2b3c4d5e6f7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE verdict ADD VALUE IF NOT EXISTS 'TLE'")
    op.execute("ALTER TYPE verdict ADD VALUE IF NOT EXISTS 'MLE'")

    op.drop_column("submissions", "submitted_output_path")
    op.drop_column("submissions", "submitted_code_path")

    op.add_column(
        "submissions",
        sa.Column("submitted_code", sa.Text(), nullable=False, server_default=""),
    )
    op.alter_column("submissions", "submitted_code", server_default=None)

    op.execute("UPDATE submissions SET language = 'unknown' WHERE language IS NULL")
    op.alter_column("submissions", "language", nullable=False)

    op.add_column(
        "submission_results",
        sa.Column("execution_time_ms", sa.Integer(), nullable=True),
    )
    op.add_column(
        "submission_results",
        sa.Column("memory_kb", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("submission_results", "memory_kb")
    op.drop_column("submission_results", "execution_time_ms")

    op.alter_column("submissions", "language", nullable=True)
    op.drop_column("submissions", "submitted_code")

    op.add_column(
        "submissions",
        sa.Column("submitted_code_path", sa.String(512), nullable=True),
    )
    op.add_column(
        "submissions",
        sa.Column(
            "submitted_output_path",
            sa.String(512),
            nullable=False,
            server_default="",
        ),
    )
    op.alter_column("submissions", "submitted_output_path", server_default=None)
    # 'TLE' and 'MLE' enum values cannot be removed from postgres enums
