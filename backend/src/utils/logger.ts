/**
 * Structured JSON Logger (Winston)
 *
 * Path: backend/src/utils/logger.ts
 *
 * Centralised logger conforming to `.cursor/rules/00-core.md` § Logging:
 *   - Structured JSON output in production.
 *   - Human-readable pretty output in development.
 *   - Level-controlled via env.LOG_LEVEL.
 *   - Sensitive keys auto-redacted (passwords, API keys, tokens, auth headers).
 *
 * Usage:
 *   import { logger } from '../utils/logger.js';
 *   logger.info('Extraction completed', { invoiceId, durationMs });
 *   logger.error('Extraction failed', { invoiceId, errorType, stack });
 */

import winston from 'winston';

import { env } from '../config/env.js';

// ─── Redaction ─────────────────────────────────────────────────────────────

/**
 * Keys whose values must NEVER appear in log output, regardless of nesting.
 * Matched case-insensitively against the lower-cased key name.
 */
const SENSITIVE_KEYS: ReadonlyArray<string> = [
  'password',
  'pass',
  'secret',
  'token',
  'apikey',
  'api_key',
  'gemini_api_key',
  'anthropic_api_key',
  'authorization',
  'cookie',
  'set-cookie',
  'jwt',
  'refresh_token',
  'access_token',
  'private_key',
];

const REDACTED_PLACEHOLDER = '[REDACTED]';
const MAX_REDACTION_DEPTH = 8;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof Error)
  );
}

/**
 * Recursively walk `value`, replacing any property whose key matches
 * `SENSITIVE_KEYS` with `REDACTED_PLACEHOLDER`. Caps recursion at
 * `MAX_REDACTION_DEPTH` to prevent stack overflow on cyclic objects.
 */
function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth >= MAX_REDACTION_DEPTH) return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactSensitive(v, depth + 1));
  }
  if (!isPlainObject(value)) return value;

  const output: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      output[key] = REDACTED_PLACEHOLDER;
    } else {
      output[key] = redactSensitive(val, depth + 1);
    }
  }
  return output;
}

/**
 * Winston attaches non-enumerable `Symbol` properties (e.g. `Symbol.for('level')`
 * from `triple-beam`) on each `info` object. `redactSensitive` rebuilds a plain
 * object via `Object.entries`, which drops those symbols — downstream formats
 * like `winston.format.colorize` then crash with "is not a function".
 */
function copySymbolProperties(from: object, to: object): void {
  for (const sym of Object.getOwnPropertySymbols(from)) {
    (to as Record<string | symbol, unknown>)[sym] = (from as Record<
      string | symbol,
      unknown
    >)[sym];
  }
}

/** Winston format that redacts sensitive keys before formatting. */
const redactionFormat = winston.format((info) => {
  const redacted = redactSensitive(info) as winston.Logform.TransformableInfo;
  if (isPlainObject(redacted)) {
    copySymbolProperties(info, redacted);
  }
  return redacted;
})();

// ─── Format selection ──────────────────────────────────────────────────────

const isProduction = env.NODE_ENV === 'production';

const productionFormat = winston.format.combine(
  redactionFormat,
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const developmentFormat = winston.format.combine(
  redactionFormat,
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ level: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const ts = typeof timestamp === 'string' ? timestamp : '';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    const stackStr = typeof stack === 'string' ? `\n${stack}` : '';
    return `${ts} ${level} ${String(message)}${metaStr}${stackStr}`;
  }),
);

// ─── Logger instance ───────────────────────────────────────────────────────

/**
 * Project-wide logger. Use this in place of `console.*` everywhere.
 *
 * @example
 *   logger.info('User authenticated', { userId, ip });
 *   logger.error('DB query failed', { sql, error: err.message });
 */
export const logger: winston.Logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: 'thai-invoice-extractor' },
  format: isProduction ? productionFormat : developmentFormat,
  transports: [new winston.transports.Console()],
});

/**
 * Build a *child* logger with permanently bound context (e.g. requestId).
 * The child inherits transports + level from the parent.
 *
 * @example
 *   const reqLogger = childLogger({ requestId, userId });
 *   reqLogger.info('Processing invoice'); // includes requestId + userId
 */
export function childLogger(
  bindings: Readonly<Record<string, unknown>>,
): winston.Logger {
  return logger.child(bindings);
}
