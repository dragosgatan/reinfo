"""add superuser to userrole enum

Revision ID: x3y4z5a6b7c8
Revises: w2x3y4z5a6b7
Create Date: 2026-06-03 00:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

revision: str = "x3y4z5a6b7c8"
down_revision: str | None = "w2x3y4z5a6b7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'superuser'")


def downgrade() -> None:
    pass
