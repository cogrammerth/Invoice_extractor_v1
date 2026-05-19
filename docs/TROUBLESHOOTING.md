# Troubleshooting

## Backend will not start

**Symptom:** `Environment validation failed` on boot.

**Fix:** Compare `backend/.env` with `backend/.env.example`. Common issues:

- `JWT_SECRET` shorter than 32 characters (after trim)
- `DATABASE_URL` not starting with `postgres://` or `postgresql://`
- Missing `ANTHROPIC_API_KEY`

Run connectivity check:

```bash
npm run check:env --prefix backend
```

## `401 Unauthorized` on upload

**Symptom:** API returns `UNAUTHORIZED` for `/api/thai-invoices/upload`.

**Fix:**

- Sign in via the UI or `POST /api/auth/login`
- Ensure the `Authorization: Bearer` header uses a non-expired JWT (`JWT_ACCESS_EXPIRES_IN`, default 15m)
- Dev-only: `npm run jwt:dev --prefix backend -- <userId>`

If the message mentions issuer/audience, verify `JWT_ISSUER` and `JWT_AUDIENCE` match between token minting and server config.

## `503 DATABASE_ERROR`

**Symptom:** Upload or list fails with database error.

**Fix:**

1. Postgres running: `npm run db:up` (repo root) or your own instance
2. `DATABASE_URL` points at the correct host/port/database
3. Migrations applied: `npm run db:migrate --prefix backend`

## CORS errors in the browser

**Symptom:** Browser blocks API calls from the SPA.

**Fix:** Set `ALLOWED_ORIGIN` in `backend/.env` to the exact frontend origin (e.g. `http://localhost:5173`). Restart the API after changes.

## Reset all extraction history (truncate)

**Removes every row** in `extractions` (not a single invoice). From repo root or `backend/`:

```bash
npm run db:truncate
```

Also delete stored invoice images:

```bash
npm run db:truncate -- --uploads
```

Also remove login users (then re-seed):

```bash
npm run db:truncate -- --users --uploads
```

Blocked when `NODE_ENV=production` unless you pass `--force` (avoid in prod).

---

## "Extraction succeeded but saving the result failed"

**Symptom:** Toast after upload; Claude ran but the row was not stored.

**Common causes:**

1. **Migrations not applied** — the `extractions` table is missing the `file_path` column (migration `002`).

   ```bash
   npm run db:setup
   ```

   Works from the **repo root** or **`backend/`** folder. Or migrate only: `npm run db:migrate`

   Restart the API after migrating (`npm run dev:backend`).

2. **API started before Postgres was ready** — restart backend after DB is up.

**Diagnose:**

```bash
cd backend
npm run db:diagnose
```

**Dev tip:** In `NODE_ENV=development`, the error message may include the PostgreSQL detail in parentheses.

---

## Extraction validation errors

**Symptom:** Upload returns `400` with `fieldErrors` (e.g. missing `invoice_number`).

**Fix:** The invoice image may be unreadable or missing required fields. The upload page shows field-level errors. Re-scan with a clearer image; Thai text is never auto-corrected.

## Rate limit (`429`)

**Symptom:** `RATE_LIMIT_EXCEEDED` on upload.

**Fix:** Wait for the sliding window (`UPLOAD_RATE_LIMIT_WINDOW_MINUTES`, default 15) or raise `UPLOAD_RATE_LIMIT_MAX` for development.

## `'docker' is not recognized` (Windows)

**Symptom:** `npm run db:setup` or `db:up` fails because Docker is not installed.

**Fix (pick one):**

1. **Install Docker Desktop** — restart the terminal, then `npm run db:setup`
2. **Use local PostgreSQL** — install [PostgreSQL 17](https://www.postgresql.org/download/windows/), create a database, set `DATABASE_URL` in `backend/.env`, start the service, then:

   ```bash
   npm run db:setup:local
   ```

`npm run db:setup` now skips Docker when it is not on PATH and only waits + migrates against `DATABASE_URL`.

## Integration tests skip or fail

**Fix:**

```bash
npm run db:setup
npm run test:integration --prefix backend
```

Ensure `DATABASE_URL` in `backend/.env` matches Docker defaults:

`postgresql://invoice:invoice@localhost:5432/invoice_extractor`

## Frontend build / API URL

**Symptom:** UI calls wrong host.

**Fix:** Set `VITE_API_URL` in `frontend/.env` before `npm run build`. Rebuild after changing env vars (Vite inlines them at build time).

## Playwright E2E

**Local:**

```bash
npm run build:frontend
npm run test:e2e
```

Playwright starts the Vite dev server (or preview in CI) automatically. Install browsers once:

```bash
npx playwright install chromium
```

## File not found for stored image

**Symptom:** `FILE_NOT_FOUND` on `/api/thai-invoices/files/:id`.

**Fix:** Row may predate file storage, or `UPLOAD_DIR` was cleared. Re-upload the invoice.
