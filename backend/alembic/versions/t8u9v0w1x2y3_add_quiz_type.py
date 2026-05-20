"""add quiz problem type and quiz_options table

Revision ID: t8u9v0w1x2y3
Revises: s7t8u9v0w1x2
Create Date: 2026-05-20

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "t8u9v0w1x2y3"
down_revision: str | None = "s7t8u9v0w1x2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE TYPE problemtype AS ENUM ('standard', 'quiz')")
    op.add_column(
        "problems",
        sa.Column(
            "problem_type",
            sa.Enum("standard", "quiz", name="problemtype"),
            nullable=False,
            server_default="standard",
        ),
    )
    op.create_table(
        "quiz_options",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("problem_id", sa.UUID(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("text_md", sa.Text(), nullable=False),
        sa.Column("text_md_en", sa.Text(), nullable=True),
        sa.Column("is_correct", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("explanation_md", sa.Text(), nullable=True),
        sa.Column("explanation_md_en", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_quiz_options_problem_id", "quiz_options", ["problem_id"])


def downgrade() -> None:
    op.drop_index("ix_quiz_options_problem_id", table_name="quiz_options")
    op.drop_table("quiz_options")
    op.drop_column("problems", "problem_type")
    op.execute("DROP TYPE problemtype")
