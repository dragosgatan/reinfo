"""Add duels: duel requests, active duels, rating history, duel stats on users.

Revision ID: j8k9l0m1n2o3
Revises: i7j8k9l0m1n2
Create Date: 2026-05-18
"""

from collections.abc import Sequence

from alembic import op

revision: str = "j8k9l0m1n2o3"
down_revision: str | None = "i7j8k9l0m1n2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duelstatus') THEN
                CREATE TYPE duelstatus AS ENUM ('pending', 'active', 'resigned', 'drawn', 'finished');
            END IF;
        END $$
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duelrequeststatus') THEN
                CREATE TYPE duelrequeststatus AS ENUM ('pending', 'accepted', 'declined', 'expired');
            END IF;
        END $$
        """
    )

    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS duel_rating integer NOT NULL DEFAULT 1200"
    )
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS duel_wins integer NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS duel_losses integer NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS duel_draws integer NOT NULL DEFAULT 0")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS duels (
            id uuid NOT NULL,
            challenger_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            opponent_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            problem_id uuid NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
            status duelstatus NOT NULL DEFAULT 'pending',
            started_at timestamptz,
            finished_at timestamptz,
            winner_id uuid REFERENCES users(id) ON DELETE SET NULL,
            time_limit_minutes integer NOT NULL,
            challenger_score integer NOT NULL DEFAULT 0,
            opponent_score integer NOT NULL DEFAULT 0,
            draw_offered_by uuid REFERENCES users(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (id)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_duels_challenger_id ON duels (challenger_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_duels_opponent_id ON duels (opponent_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_duels_status ON duels (status)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS duel_requests (
            id uuid NOT NULL,
            from_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            to_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            time_limit_minutes integer NOT NULL,
            difficulty_min integer NOT NULL,
            difficulty_max integer NOT NULL,
            status duelrequeststatus NOT NULL DEFAULT 'pending',
            created_at timestamptz NOT NULL DEFAULT now(),
            expires_at timestamptz NOT NULL,
            PRIMARY KEY (id)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_duel_requests_to_id ON duel_requests (to_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_duel_requests_from_id ON duel_requests (from_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_duel_requests_status ON duel_requests (status)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS duel_rating_history (
            id uuid NOT NULL,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            duel_id uuid NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
            rating_before integer NOT NULL,
            rating_after integer NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (id)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_duel_rating_history_user_id ON duel_rating_history (user_id)"
    )

    op.execute(
        "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS duel_id uuid REFERENCES duels(id) ON DELETE SET NULL"
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_submissions_duel_id ON submissions (duel_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_submissions_duel_id")
    op.execute("ALTER TABLE submissions DROP COLUMN IF EXISTS duel_id")

    op.execute("DROP INDEX IF EXISTS ix_duel_rating_history_user_id")
    op.execute("DROP TABLE IF EXISTS duel_rating_history")

    op.execute("DROP INDEX IF EXISTS ix_duel_requests_status")
    op.execute("DROP INDEX IF EXISTS ix_duel_requests_from_id")
    op.execute("DROP INDEX IF EXISTS ix_duel_requests_to_id")
    op.execute("DROP TABLE IF EXISTS duel_requests")

    op.execute("DROP INDEX IF EXISTS ix_duels_status")
    op.execute("DROP INDEX IF EXISTS ix_duels_opponent_id")
    op.execute("DROP INDEX IF EXISTS ix_duels_challenger_id")
    op.execute("DROP TABLE IF EXISTS duels")

    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS duel_draws")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS duel_losses")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS duel_wins")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS duel_rating")

    op.execute("DROP TYPE IF EXISTS duelrequeststatus")
    op.execute("DROP TYPE IF EXISTS duelstatus")
