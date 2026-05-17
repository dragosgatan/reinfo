"""add statement_md_en to problems

Revision ID: g5h6i7j8k9l0
Revises: e4f5a6b7c8d9
Create Date: 2026-05-17 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "g5h6i7j8k9l0"
down_revision: str | None = "e4f5a6b7c8d9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("problems", sa.Column("statement_md_en", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("problems", "statement_md_en")
