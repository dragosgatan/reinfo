"""add dataset judging: problem config, submission_kind, manual_review, metric results

Revision ID: a6b7c8d9e0f1
Revises: z5a6b7c8d9e0
Create Date: 2026-07-21

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a6b7c8d9e0f1"
down_revision: str | None = "z5a6b7c8d9e0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_OLD_VERDICT_VALUES = ("pending", "AC", "WA", "PARTIAL", "CE", "RE", "TLE", "MLE")


def upgrade() -> None:
    op.execute("ALTER TYPE verdict ADD VALUE IF NOT EXISTS 'INVALID_FORMAT'")
    op.execute("CREATE TYPE datasetmetric AS ENUM ('accuracy', 'f1', 'rmse', 'mae')")
    op.execute("CREATE TYPE submissionkind AS ENUM ('code', 'dataset')")

    op.add_column(
        "problems",
        sa.Column("dataset_metric", sa.Enum("accuracy", "f1", "rmse", "mae", name="datasetmetric")),
    )
    op.add_column("problems", sa.Column("metric_threshold", sa.Float(), nullable=True))
    op.add_column("problems", sa.Column("dataset_id_column", sa.String(128), nullable=True))
    op.add_column("problems", sa.Column("dataset_target_column", sa.String(128), nullable=True))
    op.add_column("problems", sa.Column("dataset_expected_rows", sa.Integer(), nullable=True))
    op.add_column(
        "problems",
        sa.Column(
            "require_source_in_contest",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )

    op.add_column(
        "submissions",
        sa.Column(
            "submission_kind",
            sa.Enum("code", "dataset", name="submissionkind"),
            nullable=False,
            server_default=sa.text("'code'"),
        ),
    )
    op.add_column(
        "submissions",
        sa.Column("manual_review", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column("submissions", sa.Column("dataset_csv_path", sa.Text(), nullable=True))
    op.alter_column("submissions", "submitted_code", nullable=True)

    op.add_column("submission_results", sa.Column("metric_value", sa.Float(), nullable=True))
    op.alter_column("submission_results", "test_case_id", nullable=True)


def downgrade() -> None:
    op.alter_column("submission_results", "test_case_id", nullable=False)
    op.drop_column("submission_results", "metric_value")

    op.alter_column("submissions", "submitted_code", nullable=False)
    op.drop_column("submissions", "dataset_csv_path")
    op.drop_column("submissions", "manual_review")
    op.drop_column("submissions", "submission_kind")

    op.drop_column("problems", "require_source_in_contest")
    op.drop_column("problems", "dataset_expected_rows")
    op.drop_column("problems", "dataset_target_column")
    op.drop_column("problems", "dataset_id_column")
    op.drop_column("problems", "metric_threshold")
    op.drop_column("problems", "dataset_metric")

    op.execute("DROP TYPE submissionkind")
    op.execute("DROP TYPE datasetmetric")

    op.execute("ALTER TYPE verdict RENAME TO verdict_old")
    values = ", ".join(f"'{v}'" for v in _OLD_VERDICT_VALUES)
    op.execute(f"CREATE TYPE verdict AS ENUM ({values})")
    op.execute(
        "ALTER TABLE submissions ALTER COLUMN verdict TYPE verdict USING verdict::text::verdict"
    )
    op.execute(
        "ALTER TABLE submission_results ALTER COLUMN verdict TYPE verdict "
        "USING verdict::text::verdict"
    )
    op.execute("DROP TYPE verdict_old")
