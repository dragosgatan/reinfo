"""add actual_output and expected_output_snippet to submission_results

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-05-16 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c2d3e4f5a6b7"
down_revision: str | None = "b1c2d3e4f5a6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("submission_results", sa.Column("actual_output", sa.Text(), nullable=True))
    op.add_column(
        "submission_results", sa.Column("expected_output_snippet", sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("submission_results", "expected_output_snippet")
    op.drop_column("submission_results", "actual_output")
