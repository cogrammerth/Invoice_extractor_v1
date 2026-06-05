#!/usr/bin/env bash
# Pull latest code from GitHub and rebuild Docker stack.
# Usage: /opt/invoice-extractor/scripts/deploy-docker.sh [branch]
set -euo pipefail

BRANCH="${1:-main}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"
echo "==> Fetching origin/$BRANCH"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "==> Rebuilding containers"
cd docker
docker compose up -d --build

echo "==> Status"
docker compose ps

if curl -sf http://localhost:3000/health >/dev/null; then
  echo "==> API health OK"
else
  echo "==> WARNING: API health check failed — run: docker compose logs backend"
  exit 1
fi
