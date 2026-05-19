/**
 * Truncate application data tables (development / reset).
 *
 * Usage (from backend/):
 *   npm run db:truncate              # TRUNCATE extractions only
 *   npm run db:truncate -- --uploads # also delete files under UPLOAD_DIR
 *   npm run db:truncate -- --users   # also TRUNCATE users (re-seed after)
 *
 * Flags:
 *   --confirm   Required (also set by npm script)
 *   --uploads   Remove image files under UPLOAD_DIR (not subfolders like node_modules)
 *   --users     Truncate users table (login accounts)
 *   --force     Allow when NODE_ENV=production (dangerous)
 *
 * Does NOT drop tables or re-run migrations.
 */

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

function parseArgs(argv: readonly string[]): {
  confirm: boolean;
  uploads: boolean;
  users: boolean;
  force: boolean;
} {
  return {
    confirm: argv.includes('--confirm'),
    uploads: argv.includes('--uploads'),
    users: argv.includes('--users'),
    force: argv.includes('--force'),
  };
}

function scheduleExit(code: number): void {
  setTimeout(() => {
    process.exit(code);
  }, EXIT_DEFER_MS);
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
        'Examples:',
        '  npm run db:truncate',
        '  npm run db:truncate -- --uploads',
        '  npm run db:truncate -- --users --uploads',
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

  try {
    await client.connect();

    await client.query('TRUNCATE TABLE extractions');
    truncated.push('extractions');

    if (flags.users) {
      await client.query('TRUNCATE TABLE users');
      truncated.push('users');
    }
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
    JSON.stringify({
      ok: true,
      truncated,
      uploadsCleared: flags.uploads,
      imageFilesRemoved: filesRemoved,
      hint: flags.users
        ? 'Users were removed — run: npm run user:seed -- <email> <password> [role]'
        : undefined,
    }),
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
