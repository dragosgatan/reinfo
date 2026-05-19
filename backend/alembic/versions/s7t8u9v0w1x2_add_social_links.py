"""add social links to user profile

Revision ID: s7t8u9v0w1x2
Revises: r6s7t8u9v0w1
Create Date: 2026-05-19

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "s7t8u9v0w1x2"
down_revision: str | None = "r6s7t8u9v0w1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("github_url", sa.String(256), nullable=True))
    op.add_column("users", sa.Column("link_1", sa.String(256), nullable=True))
    op.add_column("users", sa.Column("link_2", sa.String(256), nullable=True))
    op.add_column("users", sa.Column("link_3", sa.String(256), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "link_3")
    op.drop_column("users", "link_2")
    op.drop_column("users", "link_1")
    op.drop_column("users", "github_url")
