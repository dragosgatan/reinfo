"""Add security features: contest violations, submission flags, security options.

Revision ID: i7j8k9l0m1n2
Revises: h6i7j8k9l0m1
Create Date: 2026-05-17
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "i7j8k9l0m1n2"
down_revision: str | None = "h6i7j8k9l0m1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "contests",
        sa.Column(
            "fullscreen_required",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "contests",
        sa.Column(
            "copy_paste_blocked",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.add_column(
        "submissions",
        sa.Column("flag_reason", sa.Text(), nullable=True),
    )

    op.create_table(
        "contest_violations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("contest_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("violation_type", sa.String(64), nullable=False),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["contest_id"], ["contests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_contest_violations_contest_id", "contest_violations", ["contest_id"])
    op.create_index("ix_contest_violations_user_id", "contest_violations", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_contest_violations_user_id", table_name="contest_violations")
    op.drop_index("ix_contest_violations_contest_id", table_name="contest_violations")
    op.drop_table("contest_violations")
    op.drop_column("submissions", "flag_reason")
    op.drop_column("contests", "copy_paste_blocked")
    op.drop_column("contests", "fullscreen_required")
