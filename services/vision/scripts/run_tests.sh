#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="$ROOT/.venv"

if [[ ! -x "$VENV/bin/python" ]]; then
  echo "Vision virtual environment is missing. Run npm run bootstrap:vision first." >&2
  exit 1
fi

"$VENV/bin/python" -m unittest discover -s "$ROOT/tests" -p "test_*.py" -v
