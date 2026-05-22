/**
 * Print row counts and which database host DATABASE_URL points to.
 * Usage: cd backend && npm run db:count
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import pg from 'pg';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDir, '..');
dotenv.config({ path: path.join(backendRoot, '.env'), override: true });

const url = process.env.DATABASE_URL ?? '';
if (url.length === 0) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

function redactUrl(connectionString: string): string {
  try {
    const u = new URL(connectionString);
    if (u.password.length > 0) {
      u.password = '****';
    }
    return u.toString();
  } catch {
    return connectionString.replace(/:[^:@]+@/, ':****@');
  }
}

async function main(): Promise<void> {
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    const ext = await pool.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM extractions',
    );
    const usr = await pool.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM users',
    );
    console.log(
      JSON.stringify(
        {
          databaseUrl: redactUrl(url),
          extractions: ext.rows[0]?.n ?? 0,
          users: usr.rows[0]?.n ?? 0,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

void main();
