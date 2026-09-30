#!/usr/bin/env bash

# Resolve root directory relative to this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

PORT=8000
HOST="127.0.0.1"

# Check if port 8000 is occupied
if lsof -ti :$PORT >/dev/null 2>&1; then
  PID=$(lsof -ti :$PORT | head -n 1)
  # Check if it responds to health check
  if curl -s -f "http://$HOST:$PORT/health" >/dev/null 2>&1; then
    echo -e "\033[32m[Backend]\033[0m Backend is already running on http://$HOST:$PORT (PID $PID)."
    echo -e "\033[36m[Backend]\033[0m API Docs: http://$HOST:$PORT/docs"
    exit 0
  else
    echo -e "\033[33m[Backend]\033[0m Port $PORT is occupied by unresponsive process (PID $PID). Releasing port..."
    kill -9 $PID 2>/dev/null || true
    sleep 1
  fi
fi

# Determine python command
PYTHON_CMD=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_CMD="python"
else
  echo -e "\033[31m[Error]\033[0m Neither python3 nor python was found."
  exit 1
fi

echo -e "\033[34m[Backend]\033[0m Starting FastAPI backend with $PYTHON_CMD in $BACKEND_DIR..."
cd "$BACKEND_DIR"
exec $PYTHON_CMD -m uvicorn main:app --host $HOST --port $PORT --reload
