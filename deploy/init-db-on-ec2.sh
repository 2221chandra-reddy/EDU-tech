#!/usr/bin/env bash
# Run schema + seed against RDS from EC2 (uses Node in a one-off container)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/deploy/.env.production}"

cd "$ROOT"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — copy from env.production.example first"
  exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required"
  exit 1
fi

echo "[edugate] Installing backend deps (local on EC2) for db init..."
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Installing Node 20..."
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y nodejs20 || sudo dnf install -y nodejs
  else
    echo "Install Node 20 manually, then re-run this script."
    exit 1
  fi
fi

cd "$ROOT/backend"
npm install --omit=dev

export DB_MODE=postgres
export NODE_ENV="${NODE_ENV:-production}"
export JWT_SECRET="${JWT_SECRET:-edugate-init-temp-secret-min-32-characters-x}"

echo "[edugate] Running schema (db:init)..."
npm run db:init

echo "[edugate] Seeding demo data (db:seed)..."
npm run db:seed

echo "[edugate] Database ready."
echo "Change demo passwords after first login (admin@edugate.com / admin123)."
