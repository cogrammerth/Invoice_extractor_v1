/**
 * Apply SQL migrations from `db/migrations/` next to this module.
 * At runtime (compiled): `dist/db/migrations/*.sql`.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Pool } from 'pg';

function migrationsDirectory(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
}

function listMigrationFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Run all pending migration files in order. Safe to call on every boot when
 * migrations are idempotent (CREATE IF NOT EXISTS, etc.).
 */
export async function runMigrations(pool: Pool): Promise<string[]> {
  const dir = migrationsDirectory();
  const files = listMigrationFiles(dir);
  if (files.length === 0) {
    throw new Error(`No migration files found in ${dir}`);
  }

  const applied: string[] = [];
  for (const file of files) {
    const sql = readFileSync(path.join(dir, file), 'utf-8');
    await pool.query(sql);
    applied.push(file);
  }
  return applied;
}
