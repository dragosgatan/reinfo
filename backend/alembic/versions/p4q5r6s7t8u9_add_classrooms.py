"""add classrooms (classes, members, announcements, assignments, chat, DMs)

Revision ID: p4q5r6s7t8u9
Revises: o3p4q5r6s7t8
Create Date: 2026-05-19 01:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "p4q5r6s7t8u9"
down_revision: str | None = "o3p4q5r6s7t8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "classes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description_md", sa.Text(), nullable=True),
        sa.Column("join_code", sa.String(16), nullable=False),
        sa.Column("teacher_id", sa.UUID(), nullable=False),
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("join_code"),
    )
    op.create_index("ix_classes_teacher_id", "classes", ["teacher_id"])

    op.create_table(
        "class_members",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("class_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("class_id", "user_id", name="uq_class_member"),
    )
    op.create_index("ix_class_members_class_id", "class_members", ["class_id"])
    op.create_index("ix_class_members_user_id", "class_members", ["user_id"])

    op.create_table(
        "class_announcements",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("class_id", sa.UUID(), nullable=False),
        sa.Column("author_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("body_md", sa.Text(), nullable=False),
        sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_class_announcements_class_id", "class_announcements", ["class_id"])

    op.create_table(
        "class_assignments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("class_id", sa.UUID(), nullable=False),
        sa.Column("problem_id", sa.UUID(), nullable=False),
        sa.Column("note_md", sa.Text(), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("class_id", "problem_id", name="uq_class_assignment"),
    )
    op.create_index("ix_class_assignments_class_id", "class_assignments", ["class_id"])

    op.create_table(
        "class_messages",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("class_id", sa.UUID(), nullable=False),
        sa.Column("author_id", sa.UUID(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_class_messages_class_id", "class_messages", ["class_id"])

    op.create_table(
        "direct_messages",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("class_id", sa.UUID(), nullable=False),
        sa.Column("sender_id", sa.UUID(), nullable=False),
        sa.Column("receiver_id", sa.UUID(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["receiver_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_direct_messages_class_id", "direct_messages", ["class_id"])
    op.create_index("ix_direct_messages_receiver_id", "direct_messages", ["receiver_id"])


def downgrade() -> None:
    op.drop_index("ix_direct_messages_receiver_id", table_name="direct_messages")
    op.drop_index("ix_direct_messages_class_id", table_name="direct_messages")
    op.drop_table("direct_messages")

    op.drop_index("ix_class_messages_class_id", table_name="class_messages")
    op.drop_table("class_messages")

    op.drop_index("ix_class_assignments_class_id", table_name="class_assignments")
    op.drop_table("class_assignments")

    op.drop_index("ix_class_announcements_class_id", table_name="class_announcements")
    op.drop_table("class_announcements")

    op.drop_index("ix_class_members_user_id", table_name="class_members")
    op.drop_index("ix_class_members_class_id", table_name="class_members")
    op.drop_table("class_members")

    op.drop_index("ix_classes_teacher_id", table_name="classes")
    op.drop_table("classes")
