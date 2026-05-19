# API Reference

Base URL (development): `http://localhost:3000`

All JSON responses use:

```json
{ "success": true, "data": { } }
```

or on failure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "fieldErrors": [{ "field": "invoice_number", "message": "Required field" }]
  }
}
```

`fieldErrors` is present only for validation-style failures (e.g. extraction `VALIDATION_ERROR`).

Protected routes require:

```
Authorization: Bearer <access_jwt>
```

---

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Server liveness; includes `claudeModel` |
| `GET` | `/api/thai-invoices/health` | No | Router scope health |

---

## Authentication (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/auth/providers` | No | Enabled login methods (local, Microsoft, Google) |
| `POST` | `/api/auth/login` | No | Email/password login → `{ accessToken, user }` |
| `GET` | `/api/auth/oauth/microsoft` | No | Start Microsoft OAuth (redirect) |
| `GET` | `/api/auth/oauth/google` | No | Start Google OAuth (redirect) |
| `GET` | `/api/auth/oauth/microsoft/callback` | No | OAuth callback (redirects to SPA) |
| `GET` | `/api/auth/oauth/google/callback` | No | OAuth callback (redirects to SPA) |

### `POST /api/auth/login`

Body (JSON):

```json
{ "email": "user@example.com", "password": "secret" }
```

Success `200`:

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "user": { "id": "<uuid>", "email": "...", "role": "operator" }
  }
}
```

---

## Thai invoices (`/api/thai-invoices`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/thai-invoices/upload` | Yes + rate limit | Upload image → extract → persist |
| `GET` | `/api/thai-invoices/extractions` | Yes | List caller's extractions (`?limit=1–500`) |
| `GET` | `/api/thai-invoices/extractions/:id` | Yes | Single extraction (UUID) |
| `GET` | `/api/thai-invoices/files/:id` | Yes | Download stored source image |
| `GET` | `/api/thai-invoices/usage` | Yes | Token usage summary (`?days=1–365`, default 30) |

### `POST /api/thai-invoices/upload`

- Content-Type: `multipart/form-data`
- Field: `file` — `image/jpeg`, `image/png`, or `image/webp` (max `MAX_FILE_SIZE_MB`, default 20)

Success `200`:

```json
{
  "success": true,
  "data": {
    "extractionId": "<uuid>",
    "data": { "<14 Thai invoice fields>" },
    "tokensUsed": { "input": 0, "output": 0, "total": 0 },
    "durationMs": 0,
    "slow": false
  }
}
```

### `GET /api/thai-invoices/usage`

Success `200`:

```json
{
  "success": true,
  "data": {
    "summary": {
      "extractionCount": 12,
      "tokensInput": 15000,
      "tokensOutput": 4000,
      "tokensTotal": 19000,
      "estimatedCostUsd": 0.105,
      "periodDays": 30
    },
    "pricing": {
      "inputCostPerMillionUsd": 3,
      "outputCostPerMillionUsd": 15,
      "modelName": "claude-sonnet-4-6",
      "note": "Estimated cost from configured rates; not an invoice from Anthropic."
    }
  }
}
```

---

## Common error codes

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | `VALIDATION_ERROR` | Invalid input or extraction schema |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 404 | `NOT_FOUND` | Extraction not found or not owned |
| 413 | `FILE_TOO_LARGE` | Multer size limit |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Wrong file MIME type |
| 429 | `RATE_LIMIT_EXCEEDED` | Upload rate limit |
| 503 | `DATABASE_ERROR` | PostgreSQL failure |

Extraction failures from Claude may use types such as `RATE_LIMIT`, `TIMEOUT`, `INVALID_IMAGE` (see `backend/src/types/error.types.ts`).
