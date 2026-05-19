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
