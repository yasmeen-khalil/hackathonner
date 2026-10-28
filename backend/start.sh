#!/bin/sh
# Sign the One CLI in from the env (hosted), then serve. Locally run.sh is used instead.
if [ -n "$ONE_API_KEY" ]; then one init --auth manual --api-key "$ONE_API_KEY" >/dev/null 2>&1 || echo "one init failed (One actions will report it)"; fi
exec python -m uvicorn app:app --host 0.0.0.0 --port "${PORT:-8000}"
