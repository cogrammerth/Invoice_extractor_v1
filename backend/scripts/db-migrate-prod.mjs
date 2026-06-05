/**
 * Production DB migrations — Node only (no tsx). Uses compiled SQL in dist/db/migrations.
 * Railway preDeploy: npm run db:migrate:prod
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDir, '..');
const distMigrations = path.join(backendRoot, 'dist', 'db', 'migrations');
const srcMigrations = path.join(backendRoot, 'src', 'db', 'migrations');

function migrationsDirectory() {
  if (existsSync(distMigrations)) {
    return distMigrations;
  }
  if (existsSync(srcMigrations)) {
    return srcMigrations;
  }
  throw new Error(
    `No migrations directory found (checked ${distMigrations} and ${srcMigrations})`,
  );
}

function listMigrationFiles(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const dir = migrationsDirectory();
  const files = listMigrationFiles(dir);
  if (files.length === 0) {
    console.error(`No .sql files in ${dir}`);
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: dbUrl });
  const applied = [];

  try {
    await client.connect();
    for (const file of files) {
      const sql = readFileSync(path.join(dir, file), 'utf-8');
      await client.query(sql);
      applied.push(file);
      console.log(`Applied: ${file}`);
    }
  } catch (error) {
    console.error(
      'Migration failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }

  console.log(JSON.stringify({ ok: true, applied }));
}

await main();
