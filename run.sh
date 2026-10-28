#!/usr/bin/env bash
# One command runs everything: the Python API on :8000 and the web app on :3000.
set -e
cd "$(dirname "$0")"
if [ ! -f .env ]; then echo "Copy .env.example to .env and fill in the keys first."; exit 1; fi
set -a; . ./.env; set +a
PY=${PYTHON:-python3.12}
if [ ! -d backend/.venv ]; then "$PY" -m venv backend/.venv; fi
backend/.venv/bin/pip install -q -r backend/requirements.txt
if [ ! -d web/node_modules ]; then (cd web && npm install --no-audit --no-fund); fi
trap 'kill 0' EXIT
(cd backend && ../backend/.venv/bin/uvicorn app:app --host 127.0.0.1 --port "${API_PORT:-8000}") &
(cd web && NEXT_PUBLIC_API_URL="http://127.0.0.1:${API_PORT:-8000}" npm run dev -- -p "${WEB_PORT:-3000}") &
wait
