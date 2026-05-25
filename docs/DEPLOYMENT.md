# Deployment Guide

| Target | Guide |
|--------|--------|
| **Your own VPS / dedicated server** | [Self-hosted server guide](./SELF-HOSTED.md) |
| **Railway (Nixpacks or Docker)** | [Railway](#railway) below |
| **Local full stack** | [Docker Compose](#docker-compose-full-stack) below |

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

## Railway with Docker (no GitHub)

Deploy from your PC using Docker — no GitHub connection required.

### Architecture

| Railway service | Image | Dockerfile |
|-----------------|-------|------------|
| PostgreSQL | Plugin | — |
| API | `invoice-api` | `docker/Dockerfile.backend` |
| UI | `invoice-ui` | `docker/Dockerfile.frontend` |

Build context is always the **repo root** (`.`).

### A — Build and push to Docker Hub (recommended)

**1. Install Docker Desktop** and log in:

```bash
docker login
```

**2. Build backend** (from repo root):

```bash
docker build -f docker/Dockerfile.backend -t YOUR_DOCKERHUB_USER/invoice-api:latest .
```

**3. Build frontend** (set your backend URL at build time):

```bash
docker build -f docker/Dockerfile.frontend ^
  --build-arg VITE_API_URL=https://YOUR-BACKEND.up.railway.app ^
  --build-arg VITE_APP_NAME="Thai Invoice Extractor" ^
  -t YOUR_DOCKERHUB_USER/invoice-ui:latest .
```

On Linux/macOS use `\` instead of `^` for line continuation.

**4. Push images:**

```bash
docker push YOUR_DOCKERHUB_USER/invoice-api:latest
docker push YOUR_DOCKERHUB_USER/invoice-ui:latest
```

**5. On Railway:**

1. New Project → **+ New** → **Database** → **PostgreSQL**
2. **+ New** → **Empty Service** → **Deploy from Docker Hub**
3. Image: `YOUR_DOCKERHUB_USER/invoice-api:latest`
4. Add backend env vars (see Railway section above), especially `DATABASE_URL`, `RUN_MIGRATIONS_ON_START=true`
5. **Networking** → Generate domain → set `PUBLIC_API_BASE_URL`
6. Repeat for `YOUR_DOCKERHUB_USER/invoice-ui:latest` (no runtime secrets; API URL is baked in at build)
7. Update backend `ALLOWED_ORIGIN` and `FRONTEND_AUTH_CALLBACK_URL` with frontend domain → redeploy API

**6. Verify:**

```text
https://YOUR-BACKEND.up.railway.app/health
```

### B — Railway CLI + local Docker build

```bash
npm install -g @railway/cli
railway login
```

Backend (link to a service first):

```bash
cd "path/to/Invoice_extractor_v1"
railway link
railway up --dockerfile docker/Dockerfile.backend
```

Frontend (replace API URL):

```bash
railway up --dockerfile docker/Dockerfile.frontend ^
  --build-arg VITE_API_URL=https://YOUR-BACKEND.up.railway.app
```

Set variables in the Railway dashboard as in the Nixpacks section above.

### C — Test full stack locally with Docker Compose

```bash
cd docker
docker compose up --build
```

- API: http://localhost:3000
- UI: http://localhost:8080
- Configure `backend/.env` before starting (or use env vars in compose)

### Docker notes

- Backend reads `PORT` from the environment (Railway sets this automatically).
- Frontend container runs `npm start` (`serve`) and listens on `$PORT`.
- Rebuild the **frontend image** whenever `VITE_API_URL` changes.
- Upload files under `UPLOAD_DIR` are ephemeral unless you add a Railway volume.

