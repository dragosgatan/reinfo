#!/bin/bash
cd "$(dirname "$0")"
docker compose up -d db piston

# Install Piston language runtimes if not already present
echo "Waiting for Piston to be ready..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:2000/api/v2/runtimes > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

RUNTIMES=$(curl -sf http://localhost:2000/api/v2/runtimes 2>/dev/null)
if [ -z "$RUNTIMES" ] || [ "$RUNTIMES" = "[]" ]; then
    echo "Installing Piston language runtimes (first run)..."
    python3 scripts/install_piston_runtimes.py http://localhost:2000
else
    echo "Piston runtimes already installed."
fi

cd backend
# Kill any leftover process on port 8000
fuser -k 8000/tcp 2>/dev/null || true

source .venv/bin/activate
python -m app.worker &
WORKER_PID=$!
trap "kill $WORKER_PID 2>/dev/null" EXIT
uvicorn app.main:app --reload
