#!/usr/bin/env bash
# one-command production deploy, run from the repo root on the droplet: ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

# first-time tls bootstrap (skip on subsequent runs):
#   1. point api.reinfo.dev dns a record to this server's ip
#   2. install certbot: apt install -y certbot
#   3. temporarily expose port 80 and run: certbot certonly --standalone -d api.reinfo.dev
#   4. then run this script normally

echo "==> Pulling latest code..."
git pull origin main

echo "==> Building backend images..."
docker compose -f docker-compose.prod.yml build backend worker

echo "==> Starting / updating all services..."
docker compose -f docker-compose.prod.yml up -d

echo "==> Running database migrations..."
docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head

echo "==> Ensuring Piston language packages are installed..."
docker compose -f docker-compose.prod.yml exec -T backend python -c "
import httpx
for pkg in [{'language': 'typescript', 'version': '5.0.3'}]:
    r = httpx.post('http://piston:2000/api/v2/packages', json=pkg, timeout=60)
    print(pkg['language'], '->', r.json())
"

echo "==> Reloading nginx..."
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload 2>/dev/null || true

echo ""
echo "==> Deploy complete."
docker compose -f docker-compose.prod.yml ps
