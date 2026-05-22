/**
 * Validated Environment Configuration
 *
 * Path: backend/src/config/env.ts
 *
 * Single source of truth for every environment variable the backend reads.
 *
 * Per `.cursorrules` § Type Safety + § Security:
 *   - All external data (env vars are external) MUST be validated with Zod.
 *   - Secrets MUST come from the environment, never hard-coded.
 *
 * The module fails-fast at boot: if `process.env` does not satisfy
 * `envSchema`, `loadEnv()` throws a detailed error so the application
 * refuses to start with a misconfigured environment.
 *
 * Loading order recommended for `server.ts`:
 *
 *   import 'dotenv/config';        // populates process.env from .env (dev)
 *   import { env } from './config/env.js';
 *
 * Tests should NOT import this module unless they want the validator to run;
 * tests for services should construct dependencies directly via DI.
 */

import { z } from 'zod';

import { loadBackendDotenv } from './load-dotenv.js';

loadBackendDotenv();

// ─── Schema ────────────────────────────────────────────────────────────────

/**
 * Zod schema for the full validated environment.
 *
 * Defaults are chosen for safe local development. Production deployments
 * MUST set explicit values (no relying on defaults for secrets).
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce.number().int().positive().max(65_535).default(3000),

  /**
   * When true, apply SQL migrations from `dist/db/migrations` before serving.
   * Useful on Railway (`RUN_MIGRATIONS_ON_START=true`). Default false for local dev.
   */
  RUN_MIGRATIONS_ON_START: z
    .string()
    .default('false')
    .transform((s) => ['true', '1', 'yes'].includes(s.trim().toLowerCase())),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (v) => v.startsWith('postgres://') || v.startsWith('postgresql://'),
      'DATABASE_URL must be a postgres:// or postgresql:// connection string',
    ),

  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),

  /** Anthropic model id, e.g. `claude-sonnet-4-20250514` — see Anthropic docs. */
  CLAUDE_MODEL: z.string().min(1).default('claude-sonnet-4-6'),

  UPLOAD_DIR: z.string().min(1).default('./uploads'),

  MAX_FILE_SIZE_MB: z.coerce.number().positive().max(100).default(20),

  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug'])
    .default('info'),

  /**
   * HS256 signing secret for access JWTs. Use a long random string (32+ chars).
   * Production: rotate via secrets manager; prefer RS256 for multi-service setups.
   */
  JWT_SECRET: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(32, 'JWT_SECRET must be at least 32 characters (after trimming spaces)'),
    ),

  /** Validated JWT `iss` claim when set (non-empty). */
  JWT_ISSUER: z.string().min(1).default('thai-invoice-extractor'),

  /** Validated JWT `aud` claim when set (non-empty). */
  JWT_AUDIENCE: z.string().min(1).default('thai-invoice-api'),

  /**
   * Max successful upload attempts per user per window (after JWT).
   * Aligns with `.cursorrules` guidance (~100 / 15 min); tune via env in prod.
   */
  UPLOAD_RATE_LIMIT_MAX: z.coerce.number().int().positive().max(10_000).default(100),

  /** Sliding window length for upload rate limit, in whole minutes (1–1440). */
  UPLOAD_RATE_LIMIT_WINDOW_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .max(24 * 60)
    .default(15),

  /** Frontend origin for CORS (Vite dev server default). */
  ALLOWED_ORIGIN: z.string().url().default('http://localhost:5173'),

  /** Public backend URL for OAuth redirect_uri (no trailing slash). */
  PUBLIC_API_BASE_URL: z.string().url().default('http://localhost:3000'),

  /** SPA route that receives accessToken after OAuth (no trailing slash). */
  FRONTEND_AUTH_CALLBACK_URL: z
    .string()
    .url()
    .default('http://localhost:5173/auth/callback'),

  /** Access JWT lifetime (jsonwebtoken expiresIn, e.g. 15m, 1h). */
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),

  /**
   * Comma-separated allowed email domains for login/SSO (empty = any domain).
   * Example: `synnex.com,partner.com`
   */
  AUTH_ALLOWED_EMAIL_DOMAINS: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter((d) => d.length > 0),
    ),

  /** Microsoft Entra ID (Azure AD) — all three required to enable Microsoft SSO. */
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().default('common'),

  /** Google OAuth — both required to enable Google SSO. */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  /**
   * Estimated USD cost per 1M input tokens (for usage dashboard estimates).
   * Defaults approximate Claude Sonnet-class pricing; override per deployment.
   */
  CLAUDE_INPUT_COST_PER_MILLION_USD: z.coerce.number().nonnegative().default(3),

  /**
   * Estimated USD cost per 1M output tokens (for usage dashboard estimates).
   */
  CLAUDE_OUTPUT_COST_PER_MILLION_USD: z.coerce.number().nonnegative().default(15),
});

/** Validated environment shape, derived from the schema. */
export type Env = z.infer<typeof envSchema>;

// ─── Loader ────────────────────────────────────────────────────────────────

/**
 * Validate `process.env` against `envSchema`.
 *
 * Throws a descriptive `Error` if validation fails — collect all issues into
 * a single message so the operator sees every missing/invalid var at once,
 * not just the first one.
 *
 * @example
 *   try {
 *     const env = loadEnv();
 *     startServer(env);
 *   } catch (e) {
 *     console.error(e instanceof Error ? e.message : e);
 *     process.exit(1);
 *   }
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const summary = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${summary}`);
  }
  return result.data;
}

// ─── Singleton ─────────────────────────────────────────────────────────────

/**
 * The validated environment, loaded eagerly at module init.
 *
 * Importing this module from a misconfigured process will throw — that is
 * intentional. Use `loadEnv()` directly if you need to validate without
 * triggering the singleton (e.g. in unit tests).
 *
 * @example
 *   import { env } from '../config/env.js';
 *   const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
 */
export const env: Env = loadEnv();
