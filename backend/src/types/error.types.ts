/**
 * Extraction Error Classification
 *
 * Path: backend/src/types/error.types.ts
 *
 * The 9 canonical error types defined in `.cursorrules` for the AI
 * extraction pipeline. Every failure surfaced by `ClaudeExtractionService`
 * MUST classify itself into exactly one of these categories so the retry
 * queue, alerting, and HTTP response layers know what to do.
 *
 * Mapping (from `.cursorrules` → "Error Classification (9 types)"):
 *
 *   1. RATE_LIMIT          (429) → Auto-retry after 60s
 *   2. QUOTA_EXCEEDED      (403) → Queue for later
 *   3. INVALID_API_KEY     (401) → Alert admin, no retry
 *   4. TIMEOUT                  → Retry up to 3x
 *   5. SERVER_ERROR        (5xx) → Retry with exponential backoff
 *   6. NETWORK_ERROR            → Auto-retry
 *   7. MALFORMED_RESPONSE       → Log & alert (Zod parse failed)
 *   8. INVALID_IMAGE            → User action required
 *   9. VALIDATION_ERROR         → Return field-level errors to client
 */

// ─── Canonical error-type keys (string-literal union) ──────────────────────

/**
 * The 9 canonical error types, expressed as a const object so the values can
 * be referenced at runtime (`ExtractionErrorType.RATE_LIMIT`) while the union
 * type below provides compile-time exhaustiveness.
 */
export const ExtractionErrorType = {
  RATE_LIMIT: 'RATE_LIMIT',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  TIMEOUT: 'TIMEOUT',
  SERVER_ERROR: 'SERVER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  MALFORMED_RESPONSE: 'MALFORMED_RESPONSE',
  INVALID_IMAGE: 'INVALID_IMAGE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

/**
 * Union of all valid error-type string-literal keys.
 *
 * @example
 *   function handle(t: ExtractionErrorType) {
 *     switch (t) {
 *       case 'RATE_LIMIT': return retry();
 *       // exhaustive: TS errors if any case is missing
 *     }
 *   }
 */
export type ExtractionErrorType =
  (typeof ExtractionErrorType)[keyof typeof ExtractionErrorType];

// ─── Field-level error (used inside VALIDATION_ERROR) ──────────────────────

/**
 * Single field-level validation error, matching the API response shape
 * mandated by `.cursorrules` → "API Request Validation".
 *
 * @example
 *   { field: 'invoice_number', message: 'Required field' }
 */
export interface FieldError {
  readonly field: string;
  readonly message: string;
}

// ─── Rich extraction-error object ──────────────────────────────────────────

/**
 * The error payload returned from any service that can fail extraction.
 *
 * Pair with `Result<T, ExtractionError>` so callers (routes, retry queue,
 * loggers) get the full classification + retry guidance in one place.
 *
 * @example Validation failure
 *   const e: ExtractionError = {
 *     type: 'VALIDATION_ERROR',
 *     message: 'Invoice failed validation',
 *     httpStatus: 400,
 *     retryable: false,
 *     fieldErrors: [{ field: 'invoice_number', message: 'Required' }],
 *   };
 *
 * @example Upstream timeout
 *   const e: ExtractionError = {
 *     type: 'TIMEOUT',
 *     message: 'Claude API exceeded 30s',
 *     httpStatus: 504,
 *     retryable: true,
 *     retryAfterMs: 1000,
 *   };
 */
export interface ExtractionError {
  readonly type: ExtractionErrorType;
  readonly message: string;
  readonly httpStatus?: number;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly fieldErrors?: ReadonlyArray<FieldError>;
  readonly context?: Readonly<Record<string, unknown>>;
}

// ─── Retry / HTTP-status metadata table ────────────────────────────────────

/**
 * Default retry + HTTP-status behaviour for each error type, derived directly
 * from `.cursorrules` "Error Classification" section. Services may override
 * `retryable` / `retryAfterMs` for a specific occurrence (e.g. respecting an
 * upstream `Retry-After` header) but the table is the canonical default.
 */
export const EXTRACTION_ERROR_METADATA: Readonly<
  Record<
    ExtractionErrorType,
    {
      readonly httpStatus: number;
      readonly retryable: boolean;
      readonly defaultRetryAfterMs?: number;
    }
  >
> = {
  RATE_LIMIT: { httpStatus: 429, retryable: true, defaultRetryAfterMs: 60_000 },
  QUOTA_EXCEEDED: { httpStatus: 403, retryable: true, defaultRetryAfterMs: 3_600_000 },
  INVALID_API_KEY: { httpStatus: 401, retryable: false },
  TIMEOUT: { httpStatus: 504, retryable: true, defaultRetryAfterMs: 1_000 },
  SERVER_ERROR: { httpStatus: 502, retryable: true, defaultRetryAfterMs: 2_000 },
  NETWORK_ERROR: { httpStatus: 503, retryable: true, defaultRetryAfterMs: 1_000 },
  MALFORMED_RESPONSE: { httpStatus: 502, retryable: false },
  INVALID_IMAGE: { httpStatus: 422, retryable: false },
  VALIDATION_ERROR: { httpStatus: 400, retryable: false },
};

// ─── Convenience factory ───────────────────────────────────────────────────

/**
 * Build a fully-populated `ExtractionError` with sane defaults from the
 * metadata table. Reduces boilerplate at every call site.
 *
 * @example
 *   return err(createExtractionError('TIMEOUT', 'Claude exceeded 30s'));
 */
export function createExtractionError(
  type: ExtractionErrorType,
  message: string,
  overrides?: Partial<Omit<ExtractionError, 'type' | 'message'>>,
): ExtractionError {
  const meta = EXTRACTION_ERROR_METADATA[type];
  return {
    type,
    message,
    httpStatus: overrides?.httpStatus ?? meta.httpStatus,
    retryable: overrides?.retryable ?? meta.retryable,
    retryAfterMs: overrides?.retryAfterMs ?? meta.defaultRetryAfterMs,
    fieldErrors: overrides?.fieldErrors,
    context: overrides?.context,
  };
}
