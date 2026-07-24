"""add tracks, track_items, track_progress

Revision ID: a7b8c9d0e1f2
Revises: z6a7b8c9d0e1
Create Date: 2026-07-22

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a7b8c9d0e1f2"
down_revision: str | None = "z6a7b8c9d0e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # create_table auto-creates the enum types from the inline sa.Enum(...) columns,
    # a separate CREATE TYPE here would collide with it
    op.create_table(
        "tracks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("slug", sa.String(128), nullable=False),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column(
            "olympiad",
            sa.Enum("ONI", "ONIA", "ONSC", "IOAI", "CTF", "Linux", "other", name="track_olympiad"),
            nullable=False,
        ),
        sa.Column("description_md", sa.Text(), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("published", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_tracks_slug", "tracks", ["slug"])
    op.create_index("ix_tracks_created_by", "tracks", ["created_by"])

    op.create_table(
        "track_items",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("track_id", sa.UUID(), nullable=False),
        sa.Column(
            "item_type",
            sa.Enum("lesson", "problem", "ctf_challenge", name="track_item_type"),
            nullable=False,
        ),
        sa.Column("ref_id", sa.UUID(), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("prerequisite_item_id", sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(["track_id"], ["tracks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["prerequisite_item_id"], ["track_items.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_track_items_track_id", "track_items", ["track_id"])
    op.create_index("ix_track_items_prerequisite_item_id", "track_items", ["prerequisite_item_id"])

    op.create_table(
        "track_progress",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("item_id", sa.UUID(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("not_started", "in_progress", "done", name="track_item_status"),
            nullable=False,
            server_default="not_started",
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["item_id"], ["track_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "item_id", name="uq_track_progress_user_item"),
    )
    op.create_index("ix_track_progress_user_id", "track_progress", ["user_id"])
    op.create_index("ix_track_progress_item_id", "track_progress", ["item_id"])


def downgrade() -> None:
    op.drop_table("track_progress")
    op.drop_table("track_items")
    op.drop_table("tracks")
    # drop_table doesn't auto-drop the enum types it implicitly created, remove them explicitly
    op.execute("DROP TYPE track_item_status")
    op.execute("DROP TYPE track_item_type")
    op.execute("DROP TYPE track_olympiad")
