"""Add duel matchmaking queue; change starting Elo from 1200 to 800.

Revision ID: k9l0m1n2o3p4
Revises: j8k9l0m1n2o3
Create Date: 2026-05-18
"""

from collections.abc import Sequence

from alembic import op

revision: str = "k9l0m1n2o3p4"
down_revision: str | None = "j8k9l0m1n2o3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # reset default and existing unplayed users to 800
    op.execute("ALTER TABLE users ALTER COLUMN duel_rating SET DEFAULT 800")
    op.execute(
        "UPDATE users SET duel_rating = 800 "
        "WHERE duel_rating = 1200 AND duel_wins = 0 AND duel_losses = 0 AND duel_draws = 0"
    )

    op.execute(
        """
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duelqueuestatus') THEN
                CREATE TYPE duelqueuestatus AS ENUM ('waiting', 'matched', 'cancelled');
            END IF;
        END $$
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS duel_queue (
            id uuid NOT NULL,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            time_limit_minutes integer NOT NULL,
            joined_at timestamptz NOT NULL DEFAULT now(),
            expires_at timestamptz NOT NULL,
            status duelqueuestatus NOT NULL DEFAULT 'waiting',
            matched_duel_id uuid REFERENCES duels(id) ON DELETE SET NULL,
            PRIMARY KEY (id)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_duel_queue_user_id ON duel_queue (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_duel_queue_status ON duel_queue (status)")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_duel_queue_user_waiting "
        "ON duel_queue (user_id) WHERE status = 'waiting'"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_duel_queue_user_waiting")
    op.execute("DROP INDEX IF EXISTS ix_duel_queue_status")
    op.execute("DROP INDEX IF EXISTS ix_duel_queue_user_id")
    op.execute("DROP TABLE IF EXISTS duel_queue")
    op.execute("DROP TYPE IF EXISTS duelqueuestatus")
    op.execute("ALTER TABLE users ALTER COLUMN duel_rating SET DEFAULT 1200")
