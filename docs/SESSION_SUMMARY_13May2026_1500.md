# Session Summary — Thai Invoice Extraction System

**Date:** 2026-05-13
**Scope:** Initial build phase — foundation types, configuration, logger,
prompt module, and the Gemini extraction service (with full test coverage).

---

## Starting Point

A scaffold with only three files under `backend/`:

- `.env.example` (template)
- `src/db/thai-invoice-schema.ts` (placeholder)
- `src/services/thai-extraction-prompt.ts` (placeholder)

Plus rules documents (`.cursorrules`, `.cursor/rules/00-core.md`,
`.cursor/AGENTS.md`) that define strict project standards.

---

## What Was Built

### 1. Project Tooling

| File | Purpose |
|---|---|
| `backend/package.json` | ESM module, Node ≥ 24.15, scripts for `build`, `dev`, `start`, `typecheck`, `test`, `lint`, `format`. Wires `copyfiles` into `build` so `.txt` prompt assets ship to `dist/` |
| `backend/tsconfig.json` | Every strict flag from `00-core.md` exactly (no `any`, `noUncheckedIndexedAccess`, `noImplicitOverride`, etc.) |
| `backend/.gitignore` | `node_modules/`, `dist/`, `.env`, `uploads/`, logs |

### 2. Foundation Types (`backend/src/types/`)

| File | Exports |
|---|---|
| `result.types.ts` | `Result<T, E>` discriminated union + `ok()` / `err()` / `isOk()` / `isErr()` helpers (per `00-core.md` — "no throws for expected failures") |
| `error.types.ts` | `ExtractionErrorType` (the 9 canonical categories from `.cursorrules`), `ExtractionError` shape, `EXTRACTION_ERROR_METADATA` table (HTTP status + retryability per type), `createExtractionError()` factory |

### 3. Configuration & Utilities

| File | Purpose |
|---|---|
| `backend/src/config/env.ts` | Zod-validated env singleton — fails fast at boot if `GEMINI_API_KEY` / `DATABASE_URL` etc. are missing |
| `backend/src/utils/logger.ts` | Winston logger: pretty in dev, JSON in prod, recursive redaction of `password`, `api_key`, `token`, `authorization`, `cookie`, etc., plus `childLogger()` for per-request bindings |

### 4. The Prompt Module (`backend/src/services/thai-extraction-prompt.ts`)

Rewrote the 58-line placeholder into a 244-line production module:

- Loads `backend/src/prompts/thai-invoice-extraction.prompt.txt` once at
  module init via `import.meta.url`.
- Appends a **strict JSON output contract** to force Gemini to return
  parseable JSON with deterministic keys.
- Exports `thaiInvoiceExtractionSchema` (Zod) covering **all 14 real
  extraction tasks** from the `.txt` file — including a discriminated union
  for the `ชำระเงินโดย` payment method (`เงินสด` / `บัตรเครดิต` /
  `เงินโอน` / `เช็ค`) and controlled-vocabulary enums for `e_tax_flag`,
  `received_by`, `delivery_by`, `stamp`.
- Exports `ThaiInvoiceExtraction` type via `z.infer` — single source of
  truth between runtime validator and compile-time type.

### 5. The Extraction Service (`backend/src/services/gemini-extraction-service.ts`)

A 339-line, DI-constructed, transport-agnostic service:

- Public method `extractInvoice(input) → Result<ExtractInvoiceOutput, ExtractionError>`.
- Validates input (empty buffer / unsupported MIME → `INVALID_IMAGE`).
- Calls Gemini with a configurable timeout, strips ```` ```json ```` fences,
  parses + validates with the Zod schema.
- **Classifies every failure** into one of the 9 canonical types:
  `RATE_LIMIT` (429), `QUOTA_EXCEEDED` (403), `INVALID_API_KEY` (401),
  `SERVER_ERROR` (5xx), `NETWORK_ERROR` (ECONNREFUSED/etc.), `TIMEOUT`,
  `MALFORMED_RESPONSE`, `VALIDATION_ERROR`, `INVALID_IMAGE`.
- Extracts `usageMetadata` token counts for downstream billing.
- Times itself and flags `slow: true` when the 500ms p95 target is exceeded.
- Structured logging on success + failure (with redaction inherited from
  `logger.ts`).

### 6. Tests (`*.test.ts`)

**38 tests, all green:**

| Suite | Specs | Coverage |
|---|---:|---|
| `thai-extraction-prompt.test.ts` | 24 | Prompt-loader integrity (build smoke test), happy path, 255/256-char boundary, all enum validations, all 4 payment-method discriminated-union branches |
| `gemini-extraction-service.test.ts` | 14 | Happy path, fence stripping, empty buffer, bad MIME, validation error, malformed JSON, all 5 upstream HTTP error classifications, timeout, network error, performance |

---

## Verified Working

```
npm install       → 0 vulnerabilities
npm run typecheck → 0 errors (strict mode)
npm test          → 38 passed (38)
```

---

## Files Added / Modified

```
backend/
├── .gitignore                                              [NEW]
├── package.json                                            [NEW]
├── tsconfig.json                                           [NEW]
└── src/
    ├── config/
    │   └── env.ts                                          [NEW]
    ├── prompts/
    │   └── thai-invoice-extraction.prompt.txt              [pre-existing]
    ├── services/
    │   ├── thai-extraction-prompt.ts                       [REWRITTEN]
    │   ├── thai-extraction-prompt.test.ts                  [NEW]
    │   ├── gemini-extraction-service.ts                    [NEW]
    │   └── gemini-extraction-service.test.ts               [NEW]
    ├── types/
    │   ├── result.types.ts                                 [NEW]
    │   └── error.types.ts                                  [NEW]
    └── utils/
        └── logger.ts                                       [NEW]
```

**10 new files, 1 rewrite, ~1,700 lines of production TypeScript + tests.**

---

## Key Decisions Made

1. **`.js` extensions on relative imports** — for compatibility with both
   `moduleResolution: bundler` (per the rules) and native Node ESM at
   runtime.
2. **Dependency injection everywhere** — `GeminiExtractionService` takes
   `{ geminiClient, modelName, logger, timeoutMs }`, making it trivially
   testable with mocks (zero real API calls in tests).
3. **`Result<T, E>` over exceptions** — every service method returns a
   `Result`; throws are reserved for unexpected/unrecoverable failures.
4. **Single source of truth via `z.infer`** — `ThaiInvoiceExtraction` is
   derived from the Zod schema so runtime validator and compile-time type
   cannot drift apart.
5. **Build assets via `copyfiles`** — `prompts/*.txt` is copied to
   `dist/prompts/` on `npm run build` so `import.meta.url` resolution works
   after compilation.

---

## Rule Corrections Surfaced

| `.cursorrules` says | Reality | Action taken |
|---|---|---|
| `@google/generative-ai 0.21.1+` | Version `0.21.1` was never published — latest is `0.24.1` | Used `^0.24.1` in `package.json` |
| `.env.example` has `GEMINI_MODEL=gemini-1.5-pro` | `.cursorrules` mandates `gemini-2.0-flash-exp` | `env.ts` defaults to the mandated value; `.env.example` left unchanged for the user to update |

---

## What's Not Yet Built

- `server.ts` (Express bootstrap).
- `routes/thai-invoices.ts` (HTTP endpoints).
- `middleware/` (auth, validation, error-handler).
- `db/queries.ts` + real schema migration (the placeholder is still in
  place).
- WebSocket notification handler.
- Frontend (React 19 + Vite + Tailwind) — nothing started.
- `TokenTrackingService` and `RetryQueueService` (mentioned in architecture,
  not yet built).
- ESLint + Prettier configs (scripts reference them, config files don't
  exist).

---

## Logical Next Step

The minimal end-to-end runnable HTTP service:

1. `backend/src/server.ts` — Express bootstrap, validates env, constructs
   the service once, mounts the router, listens on `env.PORT`.
2. `backend/src/routes/thai-invoices.ts` — `POST /api/thai-invoices/upload`
   that accepts a file via `multer`, calls `GeminiExtractionService`, and
   maps the `Result` to an HTTP response using the `httpStatus` from
   `EXTRACTION_ERROR_METADATA`.
3. `backend/src/middleware/error-handler.middleware.ts` — final fallback
   for unhandled errors, sanitises stack traces, logs with structured
   context.

Three small files turn what we have today into a working API.
