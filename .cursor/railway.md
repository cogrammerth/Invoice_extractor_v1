# Railway project context

**Active Railway project for this repo:** `invoiceExtractor`

| Field | Value |
|-------|--------|
| Account | Kasem U (`kobkasem@gmail.com`) |
| Project ID | `354df87b-6843-48c4-98a4-d4ad20014af4` |
| Environment | `production` |
| Link | `railway link -p invoiceExtractor` (from repo root) |

## Services

| Service | Root directory | Public URL |
|---------|----------------|------------|
| `invoice-api` | `backend` | https://invoice-api-production-3d13.up.railway.app |
| `invoice-ui` | `frontend` | https://invoice-ui-production-4c66.up.railway.app |

**invoice-ui variable (required):** `API_URL` = `https://invoice-api-production-3d13.up.railway.app`

**invoice-api variables:** `ALLOWED_ORIGIN` = `https://invoice-ui-production-4c66.up.railway.app`
| `Postgres` | Railway plugin | (internal) |

When deploying, debugging, or using Railway MCP/CLI for this app, use **invoiceExtractor** — not `invoice_extractor` or other projects.

## Migrations (invoice-api)

`backend/railway.toml` runs `npm run db:migrate:prod` as **preDeployCommand** before each deploy.

One-time fix if DB is empty before redeploy:

```bash
railway link -p invoiceExtractor -s invoice-api
cd backend && railway run npm run db:migrate:prod
```

## Users (login accounts)

The `users` table starts **empty** — seed manually after migrations.

From your PC (link **Postgres** so `DATABASE_PUBLIC_URL` is injected):

```bash
cd backend
railway link -p invoiceExtractor -s Postgres -e production
railway run node scripts/list-users.mjs
railway run node scripts/seed-user-prod.mjs YOUR_EMAIL "YourPassword123!" admin
```

`railway run` on Windows uses the **public** DB URL automatically (`resolve-database-url.mjs`).
