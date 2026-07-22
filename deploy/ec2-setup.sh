#!/usr/bin/env bash
# Install Docker on Ubuntu 22.04 / Amazon Linux 2023 for EduGate
set -euo pipefail

echo "[edugate] Installing Docker..."

if [ -f /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
else
  echo "Cannot detect OS"; exit 1
fi

if [[ "${ID:-}" == "ubuntu" || "${ID_LIKE:-}" == *"debian"* ]]; then
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl git
  sudo apt-get install -y docker.io
  if ! command -v docker compose >/dev/null 2>&1; then
    sudo apt-get install -y docker-compose-v2 || true
  fi
elif [[ "${ID:-}" == "amzn" || "${ID:-}" == "amazon" ]]; then
  sudo dnf update -y || sudo yum update -y
  sudo dnf install -y docker git || sudo yum install -y docker git
else
  echo "Unsupported OS: ${ID:-unknown}. Install Docker manually."
  exit 1
fi

sudo systemctl enable docker
sudo systemctl start docker

if [ -n "${SUDO_USER:-}" ]; then
  TARGET_USER="$SUDO_USER"
elif [ -n "${USER:-}" ] && [ "$USER" != "root" ]; then
  TARGET_USER="$USER"
else
  TARGET_USER="$(logname 2>/dev/null || echo "")"
fi

if [ -n "$TARGET_USER" ] && [ "$TARGET_USER" != "root" ]; then
  sudo usermod -aG docker "$TARGET_USER"
  echo "[edugate] Added $TARGET_USER to docker group."
  echo "[edugate] Log out and SSH back in, then run: docker ps"
else
  echo "[edugate] Run: sudo usermod -aG docker YOUR_USER && re-login"
fi

docker --version
echo "[edugate] Docker setup done."
