/**
 * List public tables and row counts for DATABASE_URL in backend/.env
 * Usage: cd backend && npm run db:tables
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
    if (u.password.length > 0) u.password = '****';
    return u.toString();
  } catch {
    return connectionString.replace(/:[^:@]+@/, ':****@');
  }
}

async function main(): Promise<void> {
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );

    const counts: Record<string, number> = {};
    for (const { table_name } of tables.rows) {
      const safe = /^[a-z_][a-z0-9_]*$/i.test(table_name);
      if (!safe) continue;
      const r = await pool.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM "${table_name.replace(/"/g, '""')}"`,
      );
      counts[table_name] = r.rows[0]?.n ?? 0;
    }

    console.log(
      JSON.stringify(
        {
          databaseUrl: redactUrl(url),
          appUsesTables: ['extractions', 'users'],
          tables: counts,
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
