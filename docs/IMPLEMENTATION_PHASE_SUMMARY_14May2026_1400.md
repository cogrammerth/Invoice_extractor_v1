# Implementation Phase Summary

**Project:** Thai Invoice Extraction System (backend)  
**Phase:** Foundation + AI extraction path (pre–full production hardening)  
**Last updated:** 2026-05-14  

This document summarizes what was implemented before the next development step. Use it for onboarding, handoffs, or planning the next sprint.

---

## 1. Objectives achieved in this phase

- **Strict TypeScript** toolchain (`tsconfig.json` aligned with `.cursor/rules/00-core.md`).
- **Runtime validation** of all external AI output via **Zod**, with types derived from the schema (`z.infer`).
- **Prompt + contract:** load human instructions from `src/prompts/thai-invoice-extraction.prompt.txt`, append a **strict JSON output contract**, validate responses with `thaiInvoiceExtractionSchema`.
- **Extraction service** using **Anthropic Claude** Messages API with **vision** (image + text prompt), timeouts, token usage from `usage`, and the nine canonical **extraction error types** mapped to HTTP-friendly `Result` errors.
- **Express** app: security middleware, Thai invoice upload route, health checks, global error handler.
- **Connectivity script** `npm run check:env` for PostgreSQL + Claude smoke test.
- **Tests:** 38 Vitest cases (prompt/schema + extraction service mocks), `npm run typecheck` clean.

---

## 2. Technology choices (current)

| Layer | Choice |
|--------|--------|
| Runtime | Node 24+ (see `package.json` `engines`) |
| Language | TypeScript 5.7+, ESM (`"type": "module"`) |
| HTTP | Express 5, Helmet, CORS, Multer (memory uploads) |
| AI | `@anthropic-ai/sdk` — **Claude** vision (`messages.create`) |
| Validation | `zod` |
| Logging | `winston` (structured JSON in prod, redacted sensitive keys) |
| Database driver | `pg` (schema placeholder exists; not fully wired for persistence) |

**Note:** The stack originally targeted **Google Gemini**; it was **migrated to Claude**. Gemini-specific code and dependency were removed.

---

## 3. Repository layout (backend, relevant paths)

```
backend/
├── package.json              # scripts: build, dev, start, typecheck, test, check:env
├── tsconfig.json             # strict compiler options
├── .env.example              # ANTHROPIC_API_KEY, CLAUDE_MODEL, DATABASE_URL, …
├── scripts/
│   └── check-env-connectivity.ts
└── src/
    ├── config/
    │   └── env.ts            # Zod-validated env (fail-fast at import)
    ├── prompts/
    │   └── thai-invoice-extraction.prompt.txt
    ├── services/
    │   ├── thai-extraction-prompt.ts   # prompt load + JSON contract + Zod schema + types
    │   ├── thai-extraction-prompt.test.ts
    │   ├── claude-extraction-service.ts
    │   └── claude-extraction-service.test.ts
    ├── types/
    │   ├── result.types.ts   # Result<T,E>, ok/err helpers
    │   └── error.types.ts    # 9 extraction error types + metadata + factory
    ├── utils/
    │   └── logger.ts
    ├── middleware/
    │   └── error-handler.middleware.ts
    ├── routes/
    │   └── thai-invoices.ts
    ├── server.ts
    └── db/
        └── thai-invoice-schema.ts   # placeholder SQL (not production-complete)
```

**Build:** `npm run build` runs `tsc` and **copies** `src/prompts/**` into `dist/` so `import.meta.url` can resolve the `.txt` file at runtime.

---

## 4. Environment variables (contract)

| Variable | Role |
|----------|------|
| `ANTHROPIC_API_KEY` | Claude API key (required for extraction) |
| `CLAUDE_MODEL` | Model id, e.g. `claude-sonnet-4-6` (see Anthropic docs; invalid id → 404) |
| `DATABASE_URL` | PostgreSQL URL (required by `env.ts`; used by `check:env` and future persistence) |
| `PORT`, `NODE_ENV`, `UPLOAD_DIR`, `MAX_FILE_SIZE_MB`, `LOG_LEVEL` | Standard ops |

Local copy: `backend/.env` (never commit). Template: `backend/.env.example`.

---

## 5. API surface (implemented)

- **`GET /health`** — Liveness; includes `claudeModel` from env.
- **`GET /api/thai-invoices/health`** — Scoped health for the router.
- **`POST /api/thai-invoices/upload`** — Multipart field **`file`**; allowed MIME: `image/jpeg`, `image/png`, `image/webp`; calls `ClaudeExtractionService.extractInvoice`, returns JSON success or typed error (status from `EXTRACTION_ERROR_METADATA`).

**Auth:** Upload route uses a placeholder user id until JWT middleware exists.

---

## 6. Data flow (single upload)

1. Client sends `multipart/form-data` with `file`.
2. Multer validates size and MIME; buffer held in memory.
3. `ClaudeExtractionService` builds user message: text = full `THAI_EXTRACTION_PROMPT` + image block (base64, correct `media_type`).
4. Anthropic returns assistant text; service strips optional ```json fences, `JSON.parse`, then **`thaiInvoiceExtractionSchema.safeParse`**.
5. Success → `200` + `{ success: true, data: { data, tokensUsed, durationMs, slow } }`.  
   Failure → appropriate 4xx/5xx + `{ success: false, error: { type, code, message, fieldErrors? } }`.

---

## 7. Extraction schema (high level)

The Zod schema reflects the **14 tasks** in `thai-invoice-extraction.prompt.txt` (corner `No.`, E-TAX flag, invoice number, cust code, pages, currency, payment method, net total, delivery instructions, payment details union for Thai payment methods, item descriptions, received/delivery signatures, stamp, document groups).  
**Thai text:** preserved as printed — no transforms in Zod beyond structural validation.

---

## 8. Verification commands

```bash
cd backend
npm install
npm run typecheck    # strict TS, no emit
npm test             # 38 tests
npm run check:env    # DATABASE_URL + Claude ping (uses .env)
npm run build        # dist + copied prompts
npm run dev          # tsx watch server.ts
```

**Known pitfall:** Wrong `CLAUDE_MODEL` → Anthropic **404** `not_found_error`. Prefer ids from the current [models documentation](https://docs.anthropic.com/en/docs/about-claude/models).

---

## 9. Explicitly not done yet (suggested “next step”)

Use this as the backlog for the next phase:

1. **Persistence** — Replace placeholder `thai-invoice-schema.ts`; implement `db/queries.ts`, migrations, insert extraction results + files metadata.
2. **Auth** — JWT (per `.cursorrules`), replace anonymous upload user id.
3. **Rate limiting** — `express-rate-limit` on upload route.
4. **File storage** — Disk layout under `UPLOAD_DIR` (or S3-ready abstraction); virus scan optional.
5. **TokenTrackingService** — Persist `usage` for billing/analytics.
6. **RetryQueueService** — Classify `retryable` errors and backoff (already typed in `error.types.ts`).
7. **WebSocket** — Real-time extraction status (per architecture doc).
8. **Frontend** — React 19 + Vite upload UI.
9. **Lint/format CI** — ESLint + Prettier configs referenced in `package.json` but not fully committed in this phase.
10. **E2E** — Upload → extract → DB row (Playwright or supertest + test DB).

---

## 10. Related documents

- Earlier session recap: `docs/SESSION_SUMMARY.md` (if present — may overlap with this file).
- Rules: `.cursorrules`, `.cursor/rules/00-core.md`, `.cursor/AGENTS.md`.

---

**End of implementation phase summary.** Proceed to the next step when persistence + auth boundaries are defined (or pick items from §9 in priority order).
