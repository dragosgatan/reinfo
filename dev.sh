#!/bin/bash
cd "$(dirname "$0")"
docker compose up -d db piston
cd backend
source .venv/bin/activate
python -m app.worker &
WORKER_PID=$!
trap "kill $WORKER_PID 2>/dev/null" EXIT
uvicorn app.main:app --reload
