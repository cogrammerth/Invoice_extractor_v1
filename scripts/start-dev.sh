#!/usr/bin/env bash
# Start backend + frontend in development mode
set -euo pipefail

trap 'kill 0' EXIT
(cd backend  && npm run dev) &
(cd frontend && npm run dev) &
wait
