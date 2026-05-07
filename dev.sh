#!/bin/bash
cd "$(dirname "$0")"
docker compose up -d db
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
