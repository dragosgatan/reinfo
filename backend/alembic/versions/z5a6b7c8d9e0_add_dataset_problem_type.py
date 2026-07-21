"""add dataset problem type

Revision ID: z5a6b7c8d9e0
Revises: y4z5a6b7c8d9
Create Date: 2026-07-21

"""

from collections.abc import Sequence

from alembic import op

revision: str = "z5a6b7c8d9e0"
down_revision: str | None = "y4z5a6b7c8d9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE problemtype ADD VALUE IF NOT EXISTS 'dataset'")


def downgrade() -> None:
    op.execute("ALTER TYPE problemtype RENAME TO problemtype_old")
    op.execute("CREATE TYPE problemtype AS ENUM ('standard', 'quiz')")
    op.execute(
        "ALTER TABLE problems ALTER COLUMN problem_type TYPE problemtype "
        "USING problem_type::text::problemtype"
    )
    op.execute("DROP TYPE problemtype_old")
