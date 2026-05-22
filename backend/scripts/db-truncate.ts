/**
 * Truncate application data tables (development / reset).
 *
 * Uses DATABASE_URL from backend/.env (same as the running API).
 *
 * Usage (from backend/):
 *   npm run db:count                 # show host + row counts (run first)
 *   npm run db:truncate              # TRUNCATE extractions only
 *   npm run db:truncate -- --uploads # also delete image files under UPLOAD_DIR
 *   npm run db:truncate -- --users   # also TRUNCATE users (re-seed after)
 *   npm run db:truncate -- --legacy  # also old Railway tables (invoices, etc.)
 *
 * Flags:
 *   --confirm   Required (also set by npm script)
 *   --uploads   Remove image files under UPLOAD_DIR
 *   --users     Truncate users table (login accounts)
 *   --legacy    Truncate legacy tables if present (invoices, invoice_details, abnormal_cases)
 *   --force     Allow when NODE_ENV=production (dangerous)
 */

/** Older schema on some Railway DBs — not used by current app code. */
const LEGACY_TABLES = [
  'invoice_details',
  'abnormal_cases',
  'invoices',
] as const;

import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import pg from 'pg';

const EXIT_DEFER_MS = 200;
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDir, '..');

function loadEnv(): void {
  const envPath = path.join(backendRoot, '.env');
  const result = dotenv.config({ path: envPath, override: true });
  if (result.error) {
    throw new Error(`Could not load ${envPath}: ${result.error.message}`);
  }
}

function redactDatabaseUrl(connectionString: string): string {
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

function parseArgs(argv: readonly string[]): {
  confirm: boolean;
  uploads: boolean;
  users: boolean;
  legacy: boolean;
  force: boolean;
} {
  return {
    confirm: argv.includes('--confirm'),
    uploads: argv.includes('--uploads'),
    users: argv.includes('--users'),
    legacy: argv.includes('--legacy'),
    force: argv.includes('--force'),
  };
}

function scheduleExit(code: number): void {
  setTimeout(() => {
    process.exit(code);
  }, EXIT_DEFER_MS);
}

async function tableExists(client: pg.Client, tableName: string): Promise<boolean> {
  const r = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName],
  );
  return r.rows[0]?.exists === true;
}

async function countTable(client: pg.Client, tableName: string): Promise<number> {
  const safe = /^[a-z_][a-z0-9_]*$/i.test(tableName);
  if (!safe) return 0;
  const r = await client.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM "${tableName.replace(/"/g, '""')}"`,
  );
  return r.rows[0]?.n ?? 0;
}

async function countAllTables(
  client: pg.Client,
  includeLegacy: boolean,
): Promise<Record<string, number>> {
  const names = ['extractions', 'users', ...(includeLegacy ? [...LEGACY_TABLES] : [])];
  const out: Record<string, number> = {};
  for (const name of names) {
    if (await tableExists(client, name)) {
      out[name] = await countTable(client, name);
    }
  }
  return out;
}

async function removeImageFilesInDir(dir: string): Promise<number> {
  let removed = 0;
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return 0;
  }

  for (const name of entries) {
    const absolute = path.join(dir, name);
    const info = await stat(absolute);
    if (info.isDirectory()) {
      removed += await removeImageFilesInDir(absolute);
      continue;
    }
    const ext = path.extname(name).toLowerCase();
    if (IMAGE_EXT.has(ext)) {
      await rm(absolute, { force: true });
      removed += 1;
    }
  }
  return removed;
}

async function clearUploadDir(uploadDir: string): Promise<number> {
  const root = path.resolve(uploadDir);
  return removeImageFilesInDir(root);
}

async function main(): Promise<number> {
  const flags = parseArgs(process.argv.slice(2));

  if (!flags.confirm) {
    console.error(
      [
        'Refusing to run without --confirm.',
        '',
        'Step 1 — see which database and how many rows:',
        '  npm run db:count',
        '',
        'Step 2 — truncate (must match the app DATABASE_URL in backend/.env):',
        '  npm run db:truncate',
        '  npm run db:truncate -- --uploads',
        '  npm run db:truncate -- --users --uploads',
        '  npm run db:truncate -- --legacy   # clears invoices / invoice_details / abnormal_cases on Railway',
        '  npm run db:tables                 # list every table + row counts',
        '',
        'If History still shows rows, you may be hitting a different API/DB',
        '(e.g. Railway deploy env ≠ local .env). Truncate in Railway Query',
        'using the same Postgres service as your deployed backend.',
      ].join('\n'),
    );
    return 1;
  }

  loadEnv();

  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv === 'production' && !flags.force) {
    console.error(
      'Refusing to truncate in NODE_ENV=production. Use --force only if you are certain.',
    );
    return 1;
  }

  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl === undefined || dbUrl.length === 0) {
    console.error('DATABASE_URL is not set (check backend/.env)');
    return 1;
  }

  const client = new pg.Client({ connectionString: dbUrl });
  const truncated: string[] = [];
  let before: Record<string, number> = {};
  let after: Record<string, number> = {};

  try {
    await client.connect();
    before = await countAllTables(client, flags.legacy);

    if (flags.legacy) {
      for (const table of LEGACY_TABLES) {
        if (await tableExists(client, table)) {
          await client.query(
            `TRUNCATE TABLE "${table.replace(/"/g, '""')}" RESTART IDENTITY CASCADE`,
          );
          truncated.push(table);
        }
      }
    }

    await client.query('TRUNCATE TABLE extractions RESTART IDENTITY');
    truncated.push('extractions');

    if (flags.users) {
      await client.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
      truncated.push('users');
    }

    after = await countAllTables(client, flags.legacy);
  } catch (e: unknown) {
    console.error('Truncate failed:', e instanceof Error ? e.message : String(e));
    return 1;
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }

  let filesRemoved = 0;
  if (flags.uploads) {
    const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
    filesRemoved = await clearUploadDir(path.join(backendRoot, uploadDir));
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        databaseUrl: redactDatabaseUrl(dbUrl),
        before,
        after,
        truncated,
        uploadsCleared: flags.uploads,
        imageFilesRemoved: filesRemoved,
        hint: flags.legacy
          ? 'Legacy tables (invoices, etc.) cleared. Current app History uses extractions only.'
          : flags.users
            ? 'Users were removed — run: npm run user:seed -- <email> <password> [role]'
            : 'Users kept. Railway UI may still show invoices until you run with --legacy.',
      },
      null,
      2,
    ),
  );
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
