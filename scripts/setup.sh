#!/usr/bin/env bash
# One-time setup script
set -euo pipefail

echo "Installing backend dependencies..."
(cd backend && npm install)

echo "Installing frontend dependencies..."
(cd frontend && npm install)

echo "Copying env templates..."
[ -f backend/.env ]  || cp backend/.env.example  backend/.env
[ -f frontend/.env ] || cp frontend/.env.example frontend/.env

echo "Setup complete. Next: edit backend/.env and frontend/.env, then run scripts/start-dev.sh"
