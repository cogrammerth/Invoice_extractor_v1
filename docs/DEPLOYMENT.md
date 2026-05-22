# Deployment Guide

## Prerequisites

- Node.js **24.15+** LTS
- PostgreSQL **17+**
- Anthropic API key (Claude vision)
- Reverse proxy with TLS (production)

## Environment

Copy templates and set secrets in your platform (never commit `.env` in production):

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Backend (required)

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Claude API key |
| `JWT_SECRET` | ≥ 32 characters; rotate via secrets manager |
| `ALLOWED_ORIGIN` | Exact frontend origin (HTTPS in prod) |
| `PUBLIC_API_BASE_URL` | Public API URL for OAuth callbacks |
| `FRONTEND_AUTH_CALLBACK_URL` | SPA OAuth callback URL |

### Frontend (build-time)

| Variable | Notes |
|----------|--------|
| `VITE_API_URL` | Backend public URL |
| `VITE_APP_NAME` | Display name in UI |

## Database

```bash
npm run db:migrate --prefix backend
```

Seed a local admin (development only):

```bash
npm run user:seed --prefix backend -- admin@example.com 'ChangeMe123!' admin
```

## Build

```bash
npm run build:backend
npm run build:frontend
```

Backend entry: `backend/dist/server.js` (`npm start --prefix backend`).

Frontend static assets: `frontend/dist/` — serve with nginx, S3+CloudFront, or similar.

## Docker Compose (full stack)

```bash
cd docker
docker compose up --build
```

- API: port **3000**
- UI: port **8080** (nginx serving built frontend)
- Postgres: internal network

Ensure `backend/.env` is configured before `docker compose up`.

## Production checklist

- [ ] TLS 1.2+ on API and SPA
- [ ] `NODE_ENV=production`
- [ ] Strong `JWT_SECRET`; consider RS256 for multi-service setups
- [ ] `ALLOWED_ORIGIN` locked to production SPA URL
- [ ] Database backups (daily, tested restore)
- [ ] `UPLOAD_DIR` on durable disk or migrate to S3
- [ ] Log aggregation (JSON logs from Winston)
- [ ] Rate limits reviewed (`UPLOAD_RATE_LIMIT_*`)
- [ ] `CLAUDE_*_COST_PER_MILLION_USD` aligned with your pricing model for the usage dashboard

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs backend lint, unit + integration tests, frontend lint, unit tests, build, and Playwright smoke tests.

## Railway

This repo includes per-service config so Railway can deploy without custom build/start commands in the dashboard:

| Service | Root Directory | Config file |
|---------|----------------|-------------|
| API | `backend` | `backend/railway.toml`, `backend/nixpacks.toml` |
| UI | `frontend` | `frontend/railway.toml` |

**Build runs at deploy time; start runs compiled code only** — never compile TypeScript in the Start Command.

### 1. PostgreSQL

1. In your Railway project, add a **PostgreSQL** plugin.
2. Copy its `DATABASE_URL` into the backend service variables (or use Railway variable references).

### 2. Backend API service

1. New service → connect this GitHub repo.
2. **Settings → Root Directory:** `backend`
3. Railway reads `backend/railway.toml` automatically. Expected commands:
   - **Build:** `npm ci && npm run build`
   - **Start:** `npm start` (runs `node dist/server.js` only)
4. Set variables (minimum):

| Variable | Example / notes |
|----------|-----------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | From Railway Postgres plugin |
| `ANTHROPIC_API_KEY` | Your Claude API key |
| `JWT_SECRET` | Random string, **≥ 32 characters** |
| `ALLOWED_ORIGIN` | Frontend public URL, e.g. `https://your-app.up.railway.app` |
| `PUBLIC_API_BASE_URL` | Backend public URL, e.g. `https://your-api.up.railway.app` |
| `FRONTEND_AUTH_CALLBACK_URL` | e.g. `https://your-app.up.railway.app/auth/callback` |
| `RUN_MIGRATIONS_ON_START` | `true` (auto-migrate on boot) **or** run `npm run db:migrate` manually once |

5. Deploy. Health check: `GET /health` on your backend URL.

**Do not** set Start Command to `npm run build:backend && ...` — that causes `tsc: not found` because devDependencies are omitted at runtime.

### 3. Frontend SPA service

1. New service → same repo.
2. **Settings → Root Directory:** `frontend`
3. **Build-time** variables (required before build):

| Variable | Example |
|----------|---------|
| `VITE_API_URL` | `https://your-api.up.railway.app` |
| `VITE_APP_NAME` | `Thai Invoice Extractor` |

4. **Start:** `npm start` (serves `dist/` via `serve` on Railway's `PORT`).
5. Redeploy frontend whenever `VITE_API_URL` changes (Vite inlines it at build time).

### 4. Post-deploy checklist

- [ ] Backend `/health` returns `{ "success": true, "status": "ok" }`
- [ ] Migrations applied (`RUN_MIGRATIONS_ON_START=true` or manual `npm run db:migrate`)
- [ ] Seed admin if needed: `npm run user:seed -- admin@example.com 'ChangeMe123!' admin` (run locally against Railway `DATABASE_URL`)
- [ ] `ALLOWED_ORIGIN` matches frontend URL exactly (HTTPS)
- [ ] Uploads: `UPLOAD_DIR` is ephemeral on Railway unless you attach a volume or move to object storage

### Troubleshooting on Railway

| Symptom | Fix |
|---------|-----|
| `tsc: not found` | Root Directory must be `backend` or `frontend`; build must run in Build phase, not Start |
| `Environment validation failed` | Set required vars from `backend/.env.example` |
| `Table "extractions" does not exist` | Enable `RUN_MIGRATIONS_ON_START=true` or run migrations |
| CORS errors | Set `ALLOWED_ORIGIN` to exact frontend origin |
