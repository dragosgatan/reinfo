"""add draw_offered_at to duels

Revision ID: l0m1n2o3p4q5
Revises: k9l0m1n2o3p4
Create Date: 2026-05-18
"""

from alembic import op

revision = "l0m1n2o3p4q5"
down_revision = "k9l0m1n2o3p4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE duels ADD COLUMN IF NOT EXISTS draw_offered_at timestamptz NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE duels DROP COLUMN IF EXISTS draw_offered_at")
