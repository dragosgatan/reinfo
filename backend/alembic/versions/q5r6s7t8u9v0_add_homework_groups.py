"""Add homework groups to classes."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "q5r6s7t8u9v0"
down_revision: str | None = "p4q5r6s7t8u9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "class_homework",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("description_md", sa.Text(), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_class_homework_class_id", "class_homework", ["class_id"])

    op.add_column(
        "class_assignments",
        sa.Column("homework_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_class_assignments_homework_id",
        "class_assignments",
        "class_homework",
        ["homework_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_class_assignments_homework_id", "class_assignments", type_="foreignkey")
    op.drop_column("class_assignments", "homework_id")
    op.drop_index("ix_class_homework_class_id", "class_homework")
    op.drop_table("class_homework")
