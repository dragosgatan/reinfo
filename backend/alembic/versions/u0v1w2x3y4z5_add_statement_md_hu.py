"""add statement_md_hu to problems

Revision ID: u0v1w2x3y4z5
Revises: t8u9v0w1x2y3
Create Date: 2026-05-20 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "u0v1w2x3y4z5"
down_revision: str | None = "t8u9v0w1x2y3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("problems", sa.Column("statement_md_hu", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("problems", "statement_md_hu")
