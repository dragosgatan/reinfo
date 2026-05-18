"""add profile privacy fields and external results table

Revision ID: n1o2p3q4r5s6
Revises: m1n2o3p4q5r6
Create Date: 2026-05-19
"""

import sqlalchemy as sa

from alembic import op

revision = "n1o2p3q4r5s6"
down_revision = "m1n2o3p4q5r6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "privacy_show_email",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "privacy_show_activity",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "privacy_show_solved",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )

    op.create_table(
        "external_results",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("contest_name", sa.String(256), nullable=False),
        sa.Column("platform", sa.String(128), nullable=False),
        sa.Column("result_text", sa.String(256), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("verified_by_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["verified_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_external_results_user_id", "external_results", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_external_results_user_id", table_name="external_results")
    op.drop_table("external_results")
    op.drop_column("users", "privacy_show_solved")
    op.drop_column("users", "privacy_show_activity")
    op.drop_column("users", "privacy_show_email")
