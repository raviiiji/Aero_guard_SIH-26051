#!/usr/bin/env bash

# Resolve frontend directory relative to this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
PORT=5173

# Check if port 5173 is occupied
if lsof -ti :$PORT >/dev/null 2>&1; then
  PID=$(lsof -ti :$PORT | head -n 1)
  echo -e "\033[33m[Frontend]\033[0m Port $PORT is occupied (PID $PID). Cleaning up stale process..."
  kill -15 $PID 2>/dev/null || true
  sleep 1
  if lsof -ti :$PORT >/dev/null 2>&1; then
    kill -9 $PID 2>/dev/null || true
  fi
fi

echo -e "\033[35m[Frontend]\033[0m Starting Vite dev server in $FRONTEND_DIR..."
cd "$FRONTEND_DIR"
exec npm run dev
