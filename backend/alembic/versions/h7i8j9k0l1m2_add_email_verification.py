"""add email verification

Revision ID: h7i8j9k0l1m2
Revises: g3h4i5j6k7l8
Create Date: 2026-07-29 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "h7i8j9k0l1m2"
down_revision: str | None = "g3h4i5j6k7l8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "email_verification_tokens",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("token", sa.String(256), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    op.create_index(
        "ix_email_verification_tokens_user_id", "email_verification_tokens", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_email_verification_tokens_user_id", table_name="email_verification_tokens")
    op.drop_table("email_verification_tokens")
    op.drop_column("users", "is_verified")
