/**
 * Runs before integration tests — sets `process.env` before app modules load.
 */
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
config({ path: path.join(backendRoot, '.env'), override: true });

const integrationDb =
  process.env['INTEGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL'];

if (integrationDb !== undefined && integrationDb.length > 0) {
  process.env['DATABASE_URL'] = integrationDb;
}

process.env['NODE_ENV'] = 'test';

/** Integration must not fail because dev `.env` has a short JWT_SECRET. */
const jwtSecret = (process.env['JWT_SECRET'] ?? '').trim();
if (jwtSecret.length < 32) {
  process.env['JWT_SECRET'] =
    'integration-test-jwt-secret-at-least-32-chars-long';
}

process.env['ANTHROPIC_API_KEY'] =
  process.env['ANTHROPIC_API_KEY'] ?? 'integration-test-key-not-used';
process.env['CLAUDE_MODEL'] = process.env['CLAUDE_MODEL'] ?? 'claude-sonnet-4-6';
process.env['UPLOAD_RATE_LIMIT_MAX'] = '1000';
process.env['ALLOWED_ORIGIN'] = 'http://localhost:5173';
