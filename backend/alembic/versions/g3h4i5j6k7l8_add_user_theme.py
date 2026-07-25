"""add user theme

Revision ID: g3h4i5j6k7l8
Revises: f2g3h4i5j6k7
Create Date: 2026-07-24 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "g3h4i5j6k7l8"
down_revision: str | None = "f2g3h4i5j6k7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("theme", sa.String(32), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "theme")
