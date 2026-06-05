/**
 * Apply SQL migrations from `src/db/migrations/` using DATABASE_URL.
 *
 * Usage:
 *   cd backend && npm run db:migrate
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import pg from 'pg';

const EXIT_DEFER_MS = 200;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDir, '..');
const migrationsDir = path.join(backendRoot, 'src', 'db', 'migrations');

function listMigrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

function loadEnv(): void {
  if (process.env.DATABASE_URL) {
    return;
  }
  const envPath = path.join(backendRoot, '.env');
  const result = dotenv.config({ path: envPath, override: true });
  if (result.error) {
    throw new Error(
      `DATABASE_URL is not set and could not load ${envPath}: ${result.error.message}`,
    );
  }
}

function scheduleExit(code: number): void {
  setTimeout(() => {
    process.exit(code);
  }, EXIT_DEFER_MS);
}

async function main(): Promise<number> {
  loadEnv();
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set (check backend/.env)');
    return 1;
  }

  const files = listMigrationFiles();
  if (files.length === 0) {
    console.error(`No migration files in ${migrationsDir}`);
    return 1;
  }

  const client = new pg.Client({ connectionString: dbUrl });
  const applied: string[] = [];
  try {
    await client.connect();
    for (const file of files) {
      const migrationPath = path.join(migrationsDir, file);
      let sql: string;
      try {
        sql = readFileSync(migrationPath, 'utf-8');
      } catch (e) {
        console.error(
          `Could not read migration file:\n  ${migrationPath}\n`,
          e instanceof Error ? e.message : String(e),
        );
        return 1;
      }
      await client.query(sql);
      applied.push(file);
    }
  } catch (e) {
    console.error(
      'Migration failed:',
      e instanceof Error ? e.message : String(e),
    );
    return 1;
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }

  console.log(JSON.stringify({ ok: true, applied }));
  return 0;
}

main()
  .then((code) => {
    scheduleExit(code);
  })
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    scheduleExit(1);
  });
