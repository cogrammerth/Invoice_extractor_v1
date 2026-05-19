/**
 * Block until DATABASE_URL accepts connections (for docker compose db:up).
 *
 * Usage: cd backend && npm run db:wait
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import pg from 'pg';

const MAX_ATTEMPTS = 30;
const DELAY_MS = 1000;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(scriptDir, '..', '.env'), override: true });

const connectionString = process.env['DATABASE_URL'];
if (connectionString === undefined || connectionString.length === 0) {
  console.error(
    'DATABASE_URL is not set. Copy backend/.env.example to backend/.env',
  );
  process.exit(1);
}

async function main(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const pool = new pg.Pool({ connectionString, max: 1 });
    try {
      await pool.query('SELECT 1');
      console.log(
        JSON.stringify({ ok: true, message: 'PostgreSQL is ready', attempt }),
      );
      process.exit(0);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(
        `Attempt ${attempt}/${MAX_ATTEMPTS}: not ready (${message})`,
      );
      if (attempt === MAX_ATTEMPTS) {
        console.error(
          [
            '',
            'PostgreSQL did not become ready in time.',
            '',
            'With Docker (repo root):',
            '  npm run db:setup',
            '',
            'Without Docker — install PostgreSQL locally, then set backend/.env:',
            '  DATABASE_URL=postgresql://invoice:invoice@localhost:5432/invoice_extractor',
            '  npm run db:setup:local',
            '',
            'Or only migrate if Postgres is already running:',
            '  cd backend && npm run db:migrate',
          ].join('\n'),
        );
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, DELAY_MS));
    } finally {
      try {
        await pool.end();
      } catch {
        /* ignore */
      }
    }
  }
}

void main();
