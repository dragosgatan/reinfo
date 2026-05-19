"""Add class_id to contests for class-scoped tests.

Revision ID: r6s7t8u9v0w1
Revises: q5r6s7t8u9v0
Create Date: 2026-05-19 02:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "r6s7t8u9v0w1"
down_revision: str | None = "q5r6s7t8u9v0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "contests",
        sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_contests_class_id", "contests", ["class_id"])
    op.create_foreign_key(
        "fk_contests_class_id",
        "contests",
        "classes",
        ["class_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_contests_class_id", "contests", type_="foreignkey")
    op.drop_index("ix_contests_class_id", table_name="contests")
    op.drop_column("contests", "class_id")
