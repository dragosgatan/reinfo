"""add contest_rating on users, is_rated/rating_finalized_at on contests, contest_rating_history

Revision ID: c9d0e1f2g3h4
Revises: b8c9d0e1f2g3
Create Date: 2026-07-23

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c9d0e1f2g3h4"
down_revision: str | None = "b8c9d0e1f2g3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("contest_rating", sa.Integer(), nullable=False, server_default=sa.text("1500")),
    )
    op.add_column(
        "contests",
        sa.Column("is_rated", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "contests",
        sa.Column("rating_finalized_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "contest_rating_history",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("contest_id", sa.UUID(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("rating_before", sa.Integer(), nullable=False),
        sa.Column("rating_after", sa.Integer(), nullable=False),
        sa.Column("delta", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["contest_id"], ["contests.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_contest_rating_history_user_id", "contest_rating_history", ["user_id"])
    op.create_index(
        "ix_contest_rating_history_contest_id", "contest_rating_history", ["contest_id"]
    )


def downgrade() -> None:
    op.drop_table("contest_rating_history")
    op.drop_column("contests", "rating_finalized_at")
    op.drop_column("contests", "is_rated")
    op.drop_column("users", "contest_rating")
