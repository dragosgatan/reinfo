#!/usr/bin/env bash
# Nightly PostgreSQL backup - run via cron as root on the droplet.
# Cron example (2 AM daily): 0 2 * * * /opt/reinfo/scripts/backup.sh >> /var/log/reinfo-backup.log 2>&1
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR=/var/backups/reinfo
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

docker compose -f "$REPO_DIR/docker-compose.prod.yml" exec -T db \
    pg_dump -U reinfo reinfo \
    | gzip > "$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"

# Retain only the last 14 days
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +14 -delete

echo "[$(date -Iseconds)] Backup complete: $BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
