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

## Railway

Railway runs each service from its own root directory, so the TypeScript compiler is available during the build phase (devDependencies are installed by `npm ci`) and the compiled output is served at runtime with `node dist/server.js` — no `tsc` at startup.

### 1. Create a PostgreSQL plugin

In your Railway project, add a **PostgreSQL** plugin. Railway will automatically inject `DATABASE_URL` into any service that references it.

### 2. Deploy the backend service

In the Railway dashboard, create a new service from your GitHub repo and set:

| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |

The `npm run build` script runs `tsc && npm run copy:assets`, compiling TypeScript and copying prompt files and SQL migrations into `dist/`. The start command resolves to `node dist/server.js`.

Set the following environment variables on the backend service:

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Injected automatically by the PostgreSQL plugin |
| `ANTHROPIC_API_KEY` | Claude API key |
| `JWT_SECRET` | ≥ 32 characters; generate with `openssl rand -hex 32` |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGIN` | Exact frontend origin, e.g. `https://your-frontend.up.railway.app` |
| `PUBLIC_API_BASE_URL` | Public backend URL, e.g. `https://your-backend.up.railway.app` |
| `FRONTEND_AUTH_CALLBACK_URL` | SPA OAuth callback URL |

### 3. Run database migrations

After the first deploy, open a Railway shell on the backend service (or use the one-off command runner) and execute:

```bash
npm run db:migrate --prefix backend
```

Or, if you are already inside the `backend` root directory on the service:

```bash
npm run db:migrate
```

### 4. Deploy the frontend service

Create a second service from the same repo and set:

| Setting | Value |
|---------|-------|
| Root Directory | `frontend` |
| Build Command | `npm ci && npm run build` |
| Start Command | `npx serve -s dist -l $PORT` |

Set the following build-time environment variable:

| Variable | Notes |
|----------|-------|
| `VITE_API_URL` | Public backend URL from step 2 |

### 5. Configure CORS and OAuth callback URLs

Once both services are deployed and their public URLs are known, update the backend environment variables:

- `ALLOWED_ORIGIN` → frontend Railway URL
- `FRONTEND_AUTH_CALLBACK_URL` → frontend OAuth callback path (e.g. `https://your-frontend.up.railway.app/auth/callback`)

Redeploy the backend service after updating these values.

---

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
