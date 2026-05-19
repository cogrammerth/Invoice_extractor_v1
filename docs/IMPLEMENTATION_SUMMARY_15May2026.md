# Thai Invoice Extraction System — Implementation Summary
**Date:** 15 May 2026  
**Status:** Backend MVP Complete (~70 % of full system)  
**Tests:** 52 passing · TypeScript strict · Build succeeds

---

## 1. What Was Built (This Session)

Starting from a working Claude Vision extraction service with 38 tests, the following was added in order:

### Phase 2a — PostgreSQL Persistence
- **`src/db/migrations/001_thai_invoice_extractions.sql`** — `extractions` table (UUID PK, JSONB extraction data, token counts, source file metadata, `created_at`). Two indexes: by `invoice_number` and `(user_id, created_at DESC)`.
- **`src/config/database.ts`** — `createPool(env)` using `pg.Pool`, max 20 connections (5 in test).
- **`src/db/extraction-queries.ts`** — parameterized query factory: `insertExtraction`, `listExtractions`, `getExtractionByInvoiceNumber`, `getExtractionByIdForUser` (cross-tenant safe).
- **`src/db/thai-invoice-schema.ts`** — replaced placeholder; points to migration file.
- **`scripts/db-migrate.ts`** + `npm run db:migrate` — applies migration SQL idempotently.
- **`server.ts`** — creates pool, attaches `extractionQueries` to `res.locals`, `pool.end()` on shutdown.
- **`routes/thai-invoices.ts`** — upload handler now calls `insertExtraction`; returns `extractionId` in response; on DB failure → `503 DATABASE_ERROR`.

### Phase 2b — JWT Authentication
- **`src/utils/http-response-error.ts`** — `HttpResponseError` extracted to its own file (no env/logger imports, so unit tests don't load the env singleton).
- **`src/config/env.ts`** — added `JWT_SECRET` (≥ 32 chars, trimmed), `JWT_ISSUER`, `JWT_AUDIENCE` with Zod validation.
- **`src/middleware/auth.middleware.ts`** — `createJwtAuthMiddleware({ secret, issuer, audience })`. Verifies HS256 Bearer token, sets `req.auth.userId` from `sub`. Classifies errors: `TokenExpiredError` → "expired" message, `JsonWebTokenError` → points at secret/iss/aud mismatch.
- **`routes/thai-invoices.ts`** — converted to `createThaiInvoicesRouter({ jwtAuthMiddleware, uploadRateLimiter })` factory. Upload route requires JWT; `userId` from `req.auth.userId` replaces anonymous placeholder.
- **`scripts/issue-dev-jwt.ts`** + `npm run jwt:dev` — mints a 24h HS256 token from `.env`. Includes Windows PowerShell usage instructions.
- **`scripts/jwt-self-test.ts`** + `npm run test:jwt` — mints and verifies a token using `.env`; fast smoke check without starting the server.
- **`backend/.env`** — `JWT_SECRET` (random 64-char hex), `JWT_ISSUER`, `JWT_AUDIENCE` appended automatically.

### Phase 2c — Rate Limiting
- **`src/middleware/upload-rate-limit.middleware.ts`** — `createUploadRateLimiter({ windowMs, limit })`. Keys by `req.auth.userId` (prefix `upload:user:<sub>`); falls back to `ipKeyGenerator(req.ip)`. Returns `429` with `{ success: false, error: { code: 'RATE_LIMIT_EXCEEDED' } }`. Uses `express-rate-limit` v8, `standardHeaders: 'draft-7'`.
- **`src/config/env.ts`** — `UPLOAD_RATE_LIMIT_MAX` (default 100) and `UPLOAD_RATE_LIMIT_WINDOW_MINUTES` (default 15).
- Upload route middleware order: JWT → rate limit → multer → handler.

### GET Extraction APIs
- **`GET /api/thai-invoices/extractions`** — lists caller's extractions (JWT required, optional `?limit=1–500`).
- **`GET /api/thai-invoices/extractions/:id`** — single extraction (UUID validated; `user_id` must match JWT `sub`; 404 if absent or not owned).
- Both routes use `requireAuthUserId` helper extracted from `handleUpload`.

### Bug Fixes
- **`src/utils/logger.ts`** — `redactionFormat` preserved symbol properties (`Symbol.for('level')`) so `winston.format.colorize` no longer throws `"is not a function"` on startup.
- **`src/middleware/error-handler.middleware.ts`** — `stack` is only attached to the client JSON body when `statusCode >= 500` (not on 401, 404, etc.).

---

## 2. File Tree (backend/src)

```
src/
├── config/
│   ├── database.ts          pg.Pool factory
│   └── env.ts               Zod-validated environment (all vars)
├── db/
│   ├── migrations/
│   │   └── 001_thai_invoice_extractions.sql
│   ├── extraction-queries.ts  insert / list / get-by-id
│   ├── extraction-queries.test.ts
│   └── thai-invoice-schema.ts
├── middleware/
│   ├── auth.middleware.ts          JWT HS256 verification
│   ├── auth.middleware.test.ts
│   ├── error-handler.middleware.ts global Express error handler
│   ├── upload-rate-limit.middleware.ts
│   └── upload-rate-limit.middleware.test.ts
├── routes/
│   └── thai-invoices.ts     all /api/thai-invoices routes
├── services/
│   ├── claude-extraction-service.ts
│   ├── claude-extraction-service.test.ts
│   ├── thai-extraction-prompt.ts  Zod schema + prompt loader
│   └── thai-extraction-prompt.test.ts
├── types/
│   └── error.types.ts       9 error types + metadata table
├── utils/
│   ├── http-response-error.ts
│   └── logger.ts            Winston (dev colorize / prod JSON)
└── server.ts                Express bootstrap + shutdown
```

### scripts/
| Script | npm command | Purpose |
|--------|------------|---------|
| `check-env-connectivity.ts` | `npm run check:env` | Ping DB + Claude API |
| `db-migrate.ts` | `npm run db:migrate` | Apply SQL migration |
| `issue-dev-jwt.ts` | `npm run jwt:dev -- <userId>` | Mint 24h dev JWT |
| `jwt-self-test.ts` | `npm run test:jwt` | Verify JWT pipeline from `.env` |

---

## 3. API Reference

All routes are under `/api/thai-invoices`. Protected routes require:  
`Authorization: Bearer <JWT>`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Route health probe |
| `POST` | `/upload` | Yes + rate limit | Upload image → extract → save → return JSON |
| `GET` | `/extractions` | Yes | List caller's extractions (`?limit=1–500`) |
| `GET` | `/extractions/:id` | Yes | Get single extraction (must own it) |

Root `/health` (unauthenticated) returns server status + Claude model name.

### POST /upload request
- Content-Type: `multipart/form-data`
- Field: `file` — JPEG / PNG / WebP, max `MAX_FILE_SIZE_MB` (default 20 MB)

### POST /upload success response (200)
```json
{
  "success": true,
  "data": {
    "extractionId": "<uuid>",
    "data": { "<14 invoice fields>" },
    "tokensUsed": { "input": 1245, "output": 398, "total": 1643 },
    "durationMs": 2340,
    "slow": false
  }
}
```

### Error response shape (all failures)
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Access token expired. Mint a new one: npm run jwt:dev -- <userId>"
  }
}
```
Stack trace added only for 5xx in `NODE_ENV=development`.

---

## 4. Database

### Table: `extractions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `user_id` | TEXT NOT NULL | JWT `sub` claim |
| `request_id` | TEXT | HTTP request correlation id |
| `invoice_number` | TEXT NOT NULL | From Claude extraction |
| `cust_code` | TEXT NOT NULL | From Claude extraction |
| `extraction_data` | JSONB NOT NULL | All 14 extracted fields |
| `tokens_input` | INTEGER | Claude input tokens |
| `tokens_output` | INTEGER | Claude output tokens |
| `tokens_total` | INTEGER | Sum |
| `duration_ms` | INTEGER | Claude API latency |
| `slow` | BOOLEAN | True if > 500ms |
| `model_name` | TEXT | e.g. `claude-sonnet-4-6` |
| `source_mime_type` | TEXT | `image/jpeg` etc. |
| `source_original_filename` | TEXT | As uploaded |
| `source_file_size_bytes` | INTEGER | Checked ≥ 0 |
| `created_at` | TIMESTAMPTZ | Auto `NOW()` |

---

## 5. Environment Variables (backend/.env)

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `DATABASE_URL` | Yes | — | `postgresql://…` |
| `ANTHROPIC_API_KEY` | Yes | — | From console.anthropic.com |
| `CLAUDE_MODEL` | No | `claude-sonnet-4-6` | |
| `JWT_SECRET` | Yes | — | ≥ 32 chars, trimmed |
| `JWT_ISSUER` | No | `thai-invoice-extractor` | |
| `JWT_AUDIENCE` | No | `thai-invoice-api` | |
| `UPLOAD_RATE_LIMIT_MAX` | No | `100` | Per user per window |
| `UPLOAD_RATE_LIMIT_WINDOW_MINUTES` | No | `15` | |
| `PORT` | No | `3000` | |
| `MAX_FILE_SIZE_MB` | No | `20` | |
| `UPLOAD_DIR` | No | `./uploads` | For future file storage |
| `LOG_LEVEL` | No | `info` | `error/warn/info/debug` |
| `NODE_ENV` | No | `development` | |

---

## 6. Key Commands

```powershell
# First-time setup
npm install
npm run db:migrate        # Create extractions table

# Development
npm run dev               # tsx watch (hot reload)
npm run check:env         # Verify DB + Claude API connectivity

# Testing
npm test                  # 52 unit tests (no DB / Claude needed)
npm run test:jwt          # JWT smoke check using .env
npm run jwt:dev -- alice  # Mint 24h JWT for user "alice"

# Production
npm run build             # tsc + copy assets
npm start                 # node dist/server.js

# Windows PowerShell: use curl.exe or Invoke-RestMethod
$h = @{ Authorization = "Bearer <token>" }
Invoke-RestMethod -Uri "http://localhost:3000/api/thai-invoices/extractions" -Headers $h
```

---

## 7. Dependencies Added This Session

### Production
| Package | Version | Role |
|---------|---------|------|
| `pg` | ^8.20.0 | PostgreSQL client |
| `jsonwebtoken` | ^9.0.3 | JWT sign/verify |
| `express-rate-limit` | ^8.5.1 | Per-user upload limiting |

### Dev
| Package | Version | Role |
|---------|---------|------|
| `@types/pg` | ^8.20.0 | TypeScript types for pg |
| `@types/jsonwebtoken` | ^9.0.10 | TypeScript types for jwt |

---

## 8. What Is NOT Yet Built

| Feature | Priority | Notes |
|---------|----------|-------|
| File storage (disk / S3) | Medium | Save upload buffers to `UPLOAD_DIR` |
| Token / cost tracking table | Low | Input/output already in `extractions` |
| Retry queue | Low | `retryable` flag on errors is ready |
| WebSocket notifications | Low | Real-time extraction status |
| Frontend (React + Vite) | High | UI for upload, results, list |
| E2E / integration tests | Medium | Playwright or supertest against real DB |
| ESLint config | Low | `npm run lint` wired, config not written |
| RS256 / JWKS for prod JWT | Low | HS256 sufficient for single-service now |
| CORS locked to origin | Medium | Currently open; lock before public deploy |

---

## 9. Suggested Next Steps

1. **Frontend** — Vite + React 19: token input, file upload, show extraction JSON, list page.
2. **File storage** — write buffer to `UPLOAD_DIR/{extractionId}.{ext}`, store path on the row.
3. **CORS hardening** — set `origin` from `env.ALLOWED_ORIGIN` before any public URL.
4. **ESLint** — add `eslint.config.js` so `npm run lint` enforces project rules.
5. **Integration tests** — supertest + test DB, cover the full upload → DB → GET flow.
