#!/usr/bin/env bash
# Build and run EduGate on EC2 (port 80 → container 5000)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/deploy/.env.production}"
IMAGE_NAME="${IMAGE_NAME:-edugate}"
CONTAINER_NAME="${CONTAINER_NAME:-edugate}"
HOST_PORT="${HOST_PORT:-80}"

cd "$ROOT"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE"
  echo "Copy deploy/env.production.example → deploy/.env.production and fill values."
  exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

if [ -z "${JWT_SECRET:-}" ] || [ "${#JWT_SECRET}" -lt 32 ]; then
  echo "JWT_SECRET must be set and at least 32 characters in $ENV_FILE"
  exit 1
fi

if [ "${DB_MODE:-}" != "postgres" ] || [ -z "${DATABASE_URL:-}" ]; then
  echo "Set DB_MODE=postgres and DATABASE_URL in $ENV_FILE"
  exit 1
fi

echo "[edugate] Building image $IMAGE_NAME ..."
docker build -t "$IMAGE_NAME" .

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "[edugate] Removing old container $CONTAINER_NAME ..."
  docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

echo "[edugate] Starting on host port $HOST_PORT ..."
docker run -d --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "${HOST_PORT}:5000" \
  --env-file "$ENV_FILE" \
  -v edugate_uploads:/app/backend/uploads \
  "$IMAGE_NAME"

sleep 3
echo "[edugate] Health:"
curl -sS "http://127.0.0.1:${HOST_PORT}/api/health" || true
echo
echo "[edugate] Open http://YOUR_EC2_PUBLIC_IP (or https://your-domain)"
echo "[edugate] Logs: docker logs -f $CONTAINER_NAME"
