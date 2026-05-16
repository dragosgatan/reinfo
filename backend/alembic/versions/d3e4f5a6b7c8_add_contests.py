"""add contests, contest_problems, contest_participants; add contest visibility; wire submissions.contest_id FK

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-05-16 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "d3e4f5a6b7c8"
down_revision: str | None = "c2d3e4f5a6b7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE visibility ADD VALUE IF NOT EXISTS 'contest'")

    op.execute("CREATE TYPE scoringmode AS ENUM ('sum')")

    op.create_table(
        "contests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.String(128), nullable=False),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("description_md", sa.Text(), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "scoring_mode",
            postgresql.ENUM(name="scoringmode", create_type=False),
            nullable=False,
            server_default="sum",
        ),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("true")),
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
    op.create_index("ix_contests_created_by", "contests", ["created_by"])

    op.create_table(
        "contest_problems",
        sa.Column("contest_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["contest_id"], ["contests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("contest_id", "problem_id"),
        sa.UniqueConstraint("contest_id", "ordinal", name="uq_contest_problems_ordinal"),
    )

    op.create_table(
        "contest_participants",
        sa.Column("contest_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "registered_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["contest_id"], ["contests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("contest_id", "user_id"),
    )

    op.add_column(
        "problems", sa.Column("origin_contest_id", postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        "fk_problems_origin_contest_id",
        "problems",
        "contests",
        ["origin_contest_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_problems_origin_contest_id", "problems", ["origin_contest_id"])

    op.create_foreign_key(
        "fk_submissions_contest_id",
        "submissions",
        "contests",
        ["contest_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_submissions_contest_id", "submissions", type_="foreignkey")

    op.drop_index("ix_problems_origin_contest_id", table_name="problems")
    op.drop_constraint("fk_problems_origin_contest_id", "problems", type_="foreignkey")
    op.drop_column("problems", "origin_contest_id")

    op.drop_table("contest_participants")
    op.drop_table("contest_problems")
    op.drop_table("contests")

    op.execute("DROP TYPE scoringmode")
