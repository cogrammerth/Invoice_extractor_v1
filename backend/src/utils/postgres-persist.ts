/**
 * Helpers for persisting extraction payloads to PostgreSQL (JSONB + integers).
 */

import type { ThaiInvoiceExtraction } from '../services/thai-extraction-prompt.js';

/** PostgreSQL rejects U+0000 in text/JSON. */
export function stripNullBytes(text: string): string {
  if (!text.includes('\0')) {
    return text;
  }
  return text.split('\0').join('');
}

/**
 * Strip null bytes from all string fields recursively.
 */
export function sanitizeForPostgresJson<T>(value: T): T {
  if (typeof value === 'string') {
    return stripNullBytes(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForPostgresJson(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      out[key] = sanitizeForPostgresJson(v);
    }
    return out as T;
  }
  return value;
}

export function prepareExtractionJsonb(
  data: ThaiInvoiceExtraction,
): ThaiInvoiceExtraction {
  return sanitizeForPostgresJson(data);
}

export function coerceNonNegativeInt(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.trunc(value));
}

interface PgErrorLike {
  readonly code?: string;
  readonly message?: string;
  readonly column?: string;
}

/**
 * Map a failed extraction INSERT/UPDATE to a safe client message.
 */
export function mapExtractionPersistError(error: unknown): {
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
  readonly devDetail?: string;
} {
  const pg = error as PgErrorLike;
  const pgMessage = typeof pg.message === 'string' ? pg.message : '';
  const devDetail =
    pgMessage.length > 0 ? pgMessage : error instanceof Error ? error.message : String(error);

  if (pg.code === '42703' || /column "file_path" does not exist/i.test(pgMessage)) {
    return {
      statusCode: 503,
      code: 'DATABASE_SCHEMA_OUT_OF_DATE',
      message:
        'Database schema is missing required columns. From the repo root run: npm run db:setup (or cd backend && npm run db:migrate), then restart the API.',
      devDetail,
    };
  }

  if (pg.code === '42P01' || /relation "extractions" does not exist/i.test(pgMessage)) {
    return {
      statusCode: 503,
      code: 'DATABASE_SCHEMA_MISSING',
      message:
        'Extractions table not found. Run: npm run db:setup (or cd backend && npm run db:migrate), then restart the API.',
      devDetail,
    };
  }

  if (pg.code === '22P02' || /invalid input syntax/i.test(pgMessage)) {
    return {
      statusCode: 503,
      code: 'DATABASE_ERROR',
      message:
        'Extraction succeeded but saving the result failed (invalid data for the database). Try another image or contact support.',
      devDetail,
    };
  }

  return {
    statusCode: 503,
    code: 'DATABASE_ERROR',
    message: 'Extraction succeeded but saving the result failed. Please try again later.',
    devDetail,
  };
}
