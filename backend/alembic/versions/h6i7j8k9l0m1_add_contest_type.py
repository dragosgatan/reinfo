"""add contest_type to contests

Revision ID: h6i7j8k9l0m1
Revises: g5h6i7j8k9l0
Create Date: 2026-05-17 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "h6i7j8k9l0m1"
down_revision: str | None = "g5h6i7j8k9l0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

contesttype = sa.Enum("competition", "class_test", name="contesttype")


def upgrade() -> None:
    contesttype.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "contests",
        sa.Column(
            "contest_type",
            contesttype,
            nullable=False,
            server_default="competition",
        ),
    )


def downgrade() -> None:
    op.drop_column("contests", "contest_type")
    contesttype.drop(op.get_bind(), checkfirst=True)
