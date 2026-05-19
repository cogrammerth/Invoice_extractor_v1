/**
 * PostgreSQL connection pool
 *
 * Parameterized queries only — callers use `db/queries.ts`, not raw SQL strings
 * built from user input.
 */

import pg from 'pg';

import type { Env } from './env.js';

function poolSslOption(
  connectionString: string,
): boolean | { rejectUnauthorized: boolean } | undefined {
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get('sslmode');
    if (sslMode === 'disable') {
      return undefined;
    }
    if (
      sslMode === 'require' ||
      sslMode === 'verify-ca' ||
      sslMode === 'verify-full'
    ) {
      return { rejectUnauthorized: false };
    }
    const host = url.hostname.toLowerCase();
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local');
    if (!isLocal) {
      return { rejectUnauthorized: false };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function createPool(
  config: Pick<Env, 'DATABASE_URL' | 'NODE_ENV'>,
): pg.Pool {
  const ssl = poolSslOption(config.DATABASE_URL);
  return new pg.Pool({
    connectionString: config.DATABASE_URL,
    ...(ssl !== undefined ? { ssl } : {}),
    max: config.NODE_ENV === 'test' ? 5 : 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}
