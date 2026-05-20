"""add content_md_en and content_md_hu to lessons

Revision ID: v1w2x3y4z5a6
Revises: u0v1w2x3y4z5
Create Date: 2026-05-20 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "v1w2x3y4z5a6"
down_revision: str | None = "u0v1w2x3y4z5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("lessons", sa.Column("content_md_en", sa.Text(), nullable=True))
    op.add_column("lessons", sa.Column("content_md_hu", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("lessons", "content_md_hu")
    op.drop_column("lessons", "content_md_en")
