"""add roadmaps feature

Revision ID: y4z5a6b7c8d9
Revises: x3y4z5a6b7c8
Create Date: 2026-06-12 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "y4z5a6b7c8d9"
down_revision: str | None = "x3y4z5a6b7c8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE node_status AS ENUM ('not_started', 'in_progress', 'done');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE node_link_type AS ENUM ('problem', 'material', 'external');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    op.create_table(
        "roadmaps",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("slug", sa.String(128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(64), nullable=True),
        sa.Column(
            "is_published",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_roadmaps_slug", "roadmaps", ["slug"])
    op.create_index("ix_roadmaps_created_by", "roadmaps", ["created_by"])

    op.create_table(
        "roadmap_nodes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("roadmap_id", sa.UUID(), nullable=False),
        sa.Column("parent_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("x", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column("y", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["roadmap_id"], ["roadmaps.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["roadmap_nodes.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_roadmap_nodes_roadmap_id", "roadmap_nodes", ["roadmap_id"])
    op.create_index("ix_roadmap_nodes_parent_id", "roadmap_nodes", ["parent_id"])

    op.create_table(
        "roadmap_node_links",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("node_id", sa.UUID(), nullable=False),
        sa.Column("url", sa.String(512), nullable=False),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column(
            "link_type",
            postgresql.ENUM(name="node_link_type", create_type=False),
            nullable=False,
        ),
        sa.Column("problem_id", sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(["node_id"], ["roadmap_nodes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_roadmap_node_links_node_id", "roadmap_node_links", ["node_id"])
    op.create_index("ix_roadmap_node_links_problem_id", "roadmap_node_links", ["problem_id"])

    op.create_table(
        "roadmap_edges",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("roadmap_id", sa.UUID(), nullable=False),
        sa.Column("from_node_id", sa.UUID(), nullable=False),
        sa.Column("to_node_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["roadmap_id"], ["roadmaps.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["from_node_id"], ["roadmap_nodes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_node_id"], ["roadmap_nodes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("from_node_id", "to_node_id", name="uq_roadmap_edge"),
    )
    op.create_index("ix_roadmap_edges_roadmap_id", "roadmap_edges", ["roadmap_id"])
    op.create_index("ix_roadmap_edges_from_node_id", "roadmap_edges", ["from_node_id"])
    op.create_index("ix_roadmap_edges_to_node_id", "roadmap_edges", ["to_node_id"])

    op.create_table(
        "user_roadmap_progress",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("node_id", sa.UUID(), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(name="node_status", create_type=False),
            nullable=False,
            server_default=sa.text("'not_started'"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["node_id"], ["roadmap_nodes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "node_id", name="uq_user_node_progress"),
    )
    op.create_index("ix_user_roadmap_progress_user_id", "user_roadmap_progress", ["user_id"])
    op.create_index("ix_user_roadmap_progress_node_id", "user_roadmap_progress", ["node_id"])


def downgrade() -> None:
    op.drop_table("user_roadmap_progress")
    op.drop_table("roadmap_edges")
    op.drop_table("roadmap_node_links")
    op.drop_table("roadmap_nodes")
    op.drop_table("roadmaps")
    op.execute("DROP TYPE IF EXISTS node_status")
    op.execute("DROP TYPE IF EXISTS node_link_type")
