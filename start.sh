#!/usr/bin/env bash
# Start the Way of dashboard locally and open your default browser.
# Usage: ./start.sh
# Optional: PORT=3000 ./start.sh

set -eo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT/ui"

PORT="${PORT:-5173}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install from https://nodejs.org/" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required (bundled with Node.js)." >&2
  exit 1
fi

if [[ ! -d node_modules ]] || [[ -z "$(ls -A node_modules 2>/dev/null || true)" ]]; then
  echo "Installing UI dependencies (first run)…"
  npm install
fi

echo "Starting dev server on http://localhost:${PORT}/ — opening browser…"
exec npm run dev -- --open --host 127.0.0.1 --port "${PORT}"
