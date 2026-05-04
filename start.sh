#!/usr/bin/env bash
# ============================================================
# start.sh — One-command startup for the Content & Design Engine
# Replaces Docker. Starts all services in the correct order.
#
# Usage:
#   bash start.sh              # start everything
#   bash start.sh --no-worker  # skip Celery (sync mode only)
#   bash start.sh --no-ui      # skip frontend
#   bash start.sh --prod       # production mode (no reload)
# ============================================================

set -e

# ── Parse flags ───────────────────────────────────────────────────────────────
START_WORKER=true
START_UI=true
PROD_MODE=false

for arg in "$@"; do
  case $arg in
    --no-worker) START_WORKER=false ;;
    --no-ui)     START_UI=false ;;
    --prod)      PROD_MODE=true ;;
  esac
done

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${CYAN}[start.sh]${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
err()  { echo -e "${RED}✗${NC} $1"; }

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Content & Design Engine — Startup      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Virtual environment ───────────────────────────────────────────────────────
if [ ! -d ".venv" ]; then
  log "Creating Python virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate
ok "Virtual environment active"

# ── Install Python deps ───────────────────────────────────────────────────────
log "Checking Python dependencies..."
python -c "import fastapi, uvicorn, celery" 2>/dev/null || {
  log "Installing dependencies from requirements.txt..."
  pip install -r requirements.txt --quiet
}
ok "Python dependencies ready"

# ── Install frontend deps ─────────────────────────────────────────────────────
if [ "$START_UI" = true ] && [ ! -d "ml_test_ui/node_modules" ]; then
  log "Installing frontend dependencies..."
  npm install --prefix ml_test_ui --silent
fi

# ── Check Redis ───────────────────────────────────────────────────────────────
REDIS_AVAILABLE=false
if command -v redis-cli &>/dev/null; then
  if redis-cli ping &>/dev/null 2>&1; then
    REDIS_AVAILABLE=true
    ok "Redis is running"
  else
    warn "Redis not running. Starting redis-server..."
    redis-server --daemonize yes --logfile /tmp/redis-ce.log 2>/dev/null && {
      sleep 1
      redis-cli ping &>/dev/null && REDIS_AVAILABLE=true && ok "Redis started"
    } || warn "Could not start Redis. Async jobs will fall back to sync mode."
  fi
else
  warn "redis-cli not found. Install Redis for async job processing:"
  warn "  macOS:  brew install redis"
  warn "  Ubuntu: sudo apt install redis-server"
  warn "Running in sync mode (requests may take 30-120s)."
fi

# ── Check ffmpeg ──────────────────────────────────────────────────────────────
if command -v ffmpeg &>/dev/null; then
  ok "ffmpeg available"
else
  warn "ffmpeg not found. Video reel assembly will be skipped."
  warn "  macOS:  brew install ffmpeg"
  warn "  Ubuntu: sudo apt install ffmpeg"
fi

# ── Create required directories ───────────────────────────────────────────────
mkdir -p uploads output
ok "Directories ready (uploads/, output/)"

# ── PID tracking ─────────────────────────────────────────────────────────────
PIDS=()

cleanup() {
  echo ""
  log "Shutting down all services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null && echo "  Stopped PID $pid"
  done
  exit 0
}
trap cleanup INT TERM

# ── Start Celery worker ───────────────────────────────────────────────────────
if [ "$START_WORKER" = true ] && [ "$REDIS_AVAILABLE" = true ]; then
  log "Starting Celery worker..."
  celery -A api.worker worker \
    --loglevel=warning \
    --concurrency=1 \
    --logfile=logs/celery.log \
    --pidfile=logs/celery.pid \
    2>/dev/null &
  PIDS+=($!)
  ok "Celery worker started (PID $!)"
else
  warn "Celery worker not started. Async endpoints will use sync fallback."
fi

# ── Start FastAPI backend ─────────────────────────────────────────────────────
mkdir -p logs
log "Starting FastAPI backend..."

if [ "$PROD_MODE" = true ]; then
  uvicorn api.main:app \
    --host 0.0.0.0 --port 8000 \
    --workers 1 \
    --log-level warning \
    2>&1 | tee -a logs/api.log &
else
  uvicorn api.main:app \
    --host 0.0.0.0 --port 8000 \
    --reload \
    --log-level info \
    2>&1 | tee -a logs/api.log &
fi
PIDS+=($!)
ok "FastAPI backend started (PID $!)"

# ── Start frontend ────────────────────────────────────────────────────────────
if [ "$START_UI" = true ]; then
  log "Starting ML Test UI..."
  npm run dev --prefix ml_test_ui 2>&1 | tee -a logs/ui.log &
  PIDS+=($!)
  ok "ML Test UI started (PID $!)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   All services running                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Backend API${NC}  →  http://localhost:8000"
echo -e "  ${CYAN}API Docs${NC}     →  http://localhost:8000/docs"
[ "$START_UI" = true ] && echo -e "  ${CYAN}ML Test UI${NC}   →  http://localhost:5173"
[ "$REDIS_AVAILABLE" = true ] && [ "$START_WORKER" = true ] && \
  echo -e "  ${CYAN}Celery${NC}       →  async jobs enabled"
echo ""
echo -e "  Logs: ${YELLOW}logs/api.log${NC}, ${YELLOW}logs/ui.log${NC}, ${YELLOW}logs/celery.log${NC}"
echo ""
echo -e "  Press ${RED}Ctrl+C${NC} to stop all services."
echo ""

wait
