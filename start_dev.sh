#!/usr/bin/env bash
# Start both the FastAPI backend and the ML Test UI (Vite dev server).
# Usage: bash start_dev.sh

set -e

# ── Virtual environment ───────────────────────────────────────────────────────
if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate

# Install server deps if not present
python -c "import fastapi" 2>/dev/null || pip install fastapi "uvicorn[standard]" python-multipart

echo ""
echo "Starting FastAPI backend on http://localhost:8000 ..."
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "Starting ML Test UI on http://localhost:5173 ..."
cd ml_test_ui && npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Backend    → http://localhost:8000"
echo "  ML Test UI → http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
