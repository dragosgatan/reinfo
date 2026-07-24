"""add track audience

Revision ID: f2g3h4i5j6k7
Revises: e1f2g3h4i5j6
Create Date: 2026-07-24 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "f2g3h4i5j6k7"
down_revision: str | None = "e1f2g3h4i5j6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE track_audience AS ENUM ('scoala', 'job', 'certificare');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.add_column(
        "tracks",
        sa.Column(
            "audience",
            postgresql.ENUM(name="track_audience", create_type=False),
            nullable=False,
            server_default=sa.text("'scoala'"),
        ),
    )
    op.create_index("ix_tracks_audience", "tracks", ["audience"])


def downgrade() -> None:
    op.drop_index("ix_tracks_audience", table_name="tracks")
    op.drop_column("tracks", "audience")
    op.execute("DROP TYPE IF EXISTS track_audience")
