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

## Railway

Railway is the recommended hosting platform for this project. Both the backend and frontend are deployed as separate Railway services backed by a shared PostgreSQL plugin.

### 1. Create a new Railway project

Log in to [railway.app](https://railway.app) and create a new project.

### 2. Add a PostgreSQL plugin

Inside the project, click **+ New** → **Database** → **PostgreSQL**. Railway will provision the database and expose `DATABASE_URL` automatically to services in the same project.

### 3. Deploy the backend service

Click **+ New** → **GitHub Repo**, select this repository, and configure the service:

| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `node dist/server.js` |

The `backend/nixpacks.toml` and `backend/railway.toml` files handle this automatically when Railway detects them.

#### Required environment variables

Set these in the backend service's **Variables** tab:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Auto-injected by the PostgreSQL plugin |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `JWT_SECRET` | Random string ≥ 32 characters |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGIN` | Your frontend Railway URL (e.g. `https://myapp-frontend.up.railway.app`) |
| `PUBLIC_API_BASE_URL` | Your backend Railway URL (e.g. `https://myapp-backend.up.railway.app`) |
| `FRONTEND_AUTH_CALLBACK_URL` | Frontend OAuth callback (e.g. `https://myapp-frontend.up.railway.app/auth/callback`) |

#### Optional: run migrations automatically on deploy

Set `RUN_MIGRATIONS_ON_START=true` in the backend service variables to have the server apply all SQL migrations from `src/db/migrations/` before accepting traffic. This is the simplest approach for Railway deployments.

If you prefer to run migrations manually (e.g. to review them first), leave `RUN_MIGRATIONS_ON_START` unset (defaults to `false`) and run:

```bash
# From your local machine with DATABASE_URL set
npm run db:migrate --prefix backend
```

Or open a Railway shell on the backend service and run the same command.

### 4. Deploy the frontend service

Click **+ New** → **GitHub Repo** again (same repo), and configure a second service:

| Setting | Value |
|---------|-------|
| Root Directory | `frontend` |
| Build Command | `npm ci && npm run build` |
| Start Command | `npx serve -s dist -l $PORT` |

The `frontend/railway.toml` file handles this automatically.

#### Frontend environment variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Your backend Railway URL |
| `VITE_APP_NAME` | Display name shown in the UI |

### 5. Configure CORS and OAuth callbacks

After both services are deployed and Railway has assigned public URLs:

1. Update `ALLOWED_ORIGIN` on the backend to the exact frontend URL (no trailing slash).
2. Update `PUBLIC_API_BASE_URL` on the backend to the exact backend URL.
3. Update `FRONTEND_AUTH_CALLBACK_URL` on the backend to `<frontend-url>/auth/callback`.
4. If using Microsoft or Google SSO, add the backend OAuth redirect URI (`<backend-url>/api/auth/<provider>/callback`) to your OAuth app's allowed redirect URIs.

### 6. Post-deploy verification

```bash
# Health check — should return {"success":true,"status":"ok",...}
curl https://<backend-url>/health

# Confirm the frontend loads
open https://<frontend-url>
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs backend lint, unit + integration tests, frontend lint, unit tests, build, and Playwright smoke tests.
