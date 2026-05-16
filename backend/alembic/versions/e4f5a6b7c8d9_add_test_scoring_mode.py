"""add 'test' value to scoringmode enum

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-05-16 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

revision: str = "e4f5a6b7c8d9"
down_revision: str | None = "d3e4f5a6b7c8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE scoringmode ADD VALUE IF NOT EXISTS 'test'")


def downgrade() -> None:
    # postgres does not support removing enum values without recreating the type
    pass
