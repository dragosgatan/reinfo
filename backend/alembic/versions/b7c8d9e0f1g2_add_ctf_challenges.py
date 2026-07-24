"""add ctf challenges, attachments, solves, flag attempts, hints

Revision ID: b7c8d9e0f1g2
Revises: a6b7c8d9e0f1
Create Date: 2026-07-21

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "b7c8d9e0f1g2"
down_revision: str | None = "a6b7c8d9e0f1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # enum types are auto-created by create_table from the inline sa.Enum(...) columns, no separate CREATE TYPE
    op.create_table(
        "ctf_challenges",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("slug", sa.String(128), nullable=False),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("statement_md", sa.Text(), nullable=False),
        sa.Column(
            "category",
            sa.Enum(
                "web", "crypto", "pwn", "reverse", "forensics", "osint", "misc", name="ctfcategory"
            ),
            nullable=False,
        ),
        sa.Column("difficulty", sa.Integer(), nullable=False),
        sa.Column("base_points", sa.Integer(), nullable=False, server_default="100"),
        sa.Column(
            "scoring",
            sa.Enum("static", "dynamic", name="ctfscoring"),
            nullable=False,
            server_default="static",
        ),
        sa.Column("flag_hash", sa.Text(), nullable=False),
        sa.Column(
            "flag_case_sensitive", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column("published", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("author_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_ctf_challenges_author_id", "ctf_challenges", ["author_id"])

    op.create_table(
        "ctf_attachments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("challenge_id", sa.UUID(), nullable=False),
        sa.Column("filename", sa.String(256), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["challenge_id"], ["ctf_challenges.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ctf_attachments_challenge_id", "ctf_attachments", ["challenge_id"])

    op.create_table(
        "ctf_solves",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("challenge_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "solved_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("points_awarded", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["challenge_id"], ["ctf_challenges.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("challenge_id", "user_id", name="uq_ctf_solves_challenge_user"),
    )
    op.create_index("ix_ctf_solves_challenge_id", "ctf_solves", ["challenge_id"])
    op.create_index("ix_ctf_solves_user_id", "ctf_solves", ["user_id"])

    op.create_table(
        "ctf_flag_attempts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("challenge_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("correct", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["challenge_id"], ["ctf_challenges.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ctf_flag_attempts_challenge_id", "ctf_flag_attempts", ["challenge_id"])
    op.create_index("ix_ctf_flag_attempts_user_id", "ctf_flag_attempts", ["user_id"])

    op.create_table(
        "ctf_hints",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("challenge_id", sa.UUID(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content_md", sa.Text(), nullable=False),
        sa.Column("cost", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["challenge_id"], ["ctf_challenges.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ctf_hints_challenge_id", "ctf_hints", ["challenge_id"])

    op.create_table(
        "ctf_hint_reveals",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("hint_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "revealed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["hint_id"], ["ctf_hints.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("hint_id", "user_id", name="uq_ctf_hint_reveals_hint_user"),
    )
    op.create_index("ix_ctf_hint_reveals_hint_id", "ctf_hint_reveals", ["hint_id"])
    op.create_index("ix_ctf_hint_reveals_user_id", "ctf_hint_reveals", ["user_id"])


def downgrade() -> None:
    op.drop_table("ctf_hint_reveals")
    op.drop_table("ctf_hints")
    op.drop_table("ctf_flag_attempts")
    op.drop_table("ctf_solves")
    op.drop_table("ctf_attachments")
    op.drop_table("ctf_challenges")
    # drop_table doesn't auto-drop the enum types create_table auto-created, remove explicitly
    op.execute("DROP TYPE ctfscoring")
    op.execute("DROP TYPE ctfcategory")
