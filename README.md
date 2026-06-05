# Thai Invoice Extractor

Production-oriented web app for extracting structured data from Thai invoice images using **Claude Vision**, with PostgreSQL persistence, JWT auth, and a React 19 UI.

**Repository:** [github.com/cogrammerth/Invoice_extractor_v1](https://github.com/cogrammerth/Invoice_extractor_v1)

## Features

- 14-field Thai invoice extraction (exact Thai text preservation)
- Email/password and optional Microsoft/Google SSO
- Upload history, source image download, token usage dashboard
- Field-level validation errors on failed extractions
- Rate limiting, structured logging, Docker Compose

## Quick start

### 1. Database

**With Docker Desktop** (recommended):

```bash
# From repo root OR from backend/ (both work)
npm run db:setup
```

**Without Docker** — use a local PostgreSQL instance, set `DATABASE_URL` in `backend/.env`, then:

```bash
npm run db:setup:local
# or from repo root: npm run db:setup:local
```

If `db:setup` reports Docker is missing, it still waits for Postgres and runs migrations when your server is already running.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: ANTHROPIC_API_KEY, JWT_SECRET, DATABASE_URL
npm install
npm run db:migrate
npm run user:seed -- admin@example.com 'ChangeMe123!' admin
npm run dev
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`, sign in, and upload a JPEG/PNG/WebP invoice.

## Scripts (repo root)

| Command | Description |
|---------|-------------|
| `npm run dev:backend` | API on port 3000 |
| `npm run dev:frontend` | Vite dev server |
| `npm run lint` | ESLint (backend + frontend) |
| `npm test` | Backend unit tests |
| `npm run test:frontend` | Frontend unit tests |
| `npm run test:integration` | Backend integration tests (needs Postgres) |
| `npm run db:truncate` | **Dev only:** `TRUNCATE extractions` (all upload history) |
| `npm run db:truncate -- --uploads` | Truncate + delete images under `backend/uploads/` |
| `npm run test:e2e` | Playwright smoke tests |
| `npm run test:all` | Backend unit + frontend unit + integration |

## Documentation

- [**Deployment guide (HTML)**](docs/DEPLOY.html) — easy to read in browser
- [Cursor + Railway MCP](docs/DEPLOY.md#cursor--railway-mcp) — manage deploys from Cursor
- [Deployment guide (Markdown)](docs/DEPLOY.md) — Railway + GitHub, local Docker (LAN), VPS
- [API reference](docs/API.md)
- [Deployment reference](docs/DEPLOYMENT.md) — build commands, Railway Docker images
- [Self-hosted server (VPS)](docs/SELF-HOSTED.md) — Nginx, TLS, bare metal
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Architecture](docs/ARCHITECTURE.md) (overview)
- [Implementation summary (May 2026)](docs/IMPLEMENTATION_SUMMARY_15May2026.md)

## Project structure

```
invoice_extractor_v1/
├── backend/          # Express + Claude + PostgreSQL
├── frontend/         # React 19 + Vite + Tailwind 4
├── docker/           # Compose (Postgres, API, UI)
├── docs/             # API, deployment, troubleshooting
├── tests/e2e/        # Playwright smoke tests
└── .github/workflows # CI
```

## Configuration

See `backend/.env.example` and `frontend/.env.example`. Never commit real secrets.

## License

Private / internal — see your organization.
