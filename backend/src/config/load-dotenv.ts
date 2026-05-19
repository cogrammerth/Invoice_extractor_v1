/**
 * Load `backend/.env` with override so file values win over stale OS-level env vars
 * (e.g. an old DATABASE_URL pointing at localhost:5432).
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const envPath = path.join(backendRoot, '.env');

let loaded = false;

/**
 * Idempotent: call before reading `process.env` for app configuration.
 */
export function loadBackendDotenv(): void {
  if (loaded) {
    return;
  }
  if (existsSync(envPath)) {
    const result = dotenv.config({ path: envPath, override: true });
    if (result.error) {
      throw new Error(`Could not load ${envPath}: ${result.error.message}`);
    }
  }
  loaded = true;
}
