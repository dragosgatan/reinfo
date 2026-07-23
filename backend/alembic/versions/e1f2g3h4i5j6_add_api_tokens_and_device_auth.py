"""add api_tokens and device_auth_requests

Revision ID: e1f2g3h4i5j6
Revises: d0e1f2g3h4i5
Create Date: 2026-07-23

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "e1f2g3h4i5j6"
down_revision: str | None = "d0e1f2g3h4i5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "api_tokens",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("label", sa.String(128), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_api_tokens_user_id", "api_tokens", ["user_id"])
    op.create_index("ix_api_tokens_token_hash", "api_tokens", ["token_hash"])

    # create_table's inline sa.Enum auto-creates the deviceauthstatus type - a
    # separate CREATE TYPE here would collide with it (see contest/ctf migrations
    # for the same lesson learned). downgrade() must drop the type explicitly,
    # since drop_table does NOT do that automatically.
    op.create_table(
        "device_auth_requests",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("device_code", sa.String(64), nullable=False),
        sa.Column("user_code", sa.String(16), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "approved", "denied", "expired", name="deviceauthstatus"),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("issued_token_plaintext", sa.String(80), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("device_code"),
        sa.UniqueConstraint("user_code"),
    )
    op.create_index("ix_device_auth_requests_device_code", "device_auth_requests", ["device_code"])
    op.create_index("ix_device_auth_requests_user_code", "device_auth_requests", ["user_code"])


def downgrade() -> None:
    op.drop_table("device_auth_requests")
    op.execute("DROP TYPE deviceauthstatus")
    op.drop_table("api_tokens")
