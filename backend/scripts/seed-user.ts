/**
 * Create or update a local (email/password) user.
 *
 * Usage (from backend/):
 *   npm run user:seed -- admin@example.com 'YourPassword' admin
 *
 * Roles: admin | operator | viewer
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

import dotenv from 'dotenv';
import pg from 'pg';

import { createAuthStack } from '../src/config/auth-factory.js';
import { loadEnv } from '../src/config/env.js';
import { createUserQueries } from '../src/db/user-queries.js';
import { normalizeEmail } from '../src/utils/email.js';
import type { UserRole } from '../src/types/auth.types.js';
import { USER_ROLES } from '../src/types/auth.types.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(scriptDir, '..', '.env');

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}`);
  process.exit(1);
}

dotenv.config({ path: envPath, override: true });

async function main(): Promise<void> {
  const emailArg = process.argv[2]?.trim();
  const passwordArg = process.argv[3];
  const roleArg = (process.argv[4]?.trim() ?? 'operator') as UserRole;

  if (emailArg === undefined || emailArg.length === 0) {
    console.error('Usage: npm run user:seed -- <email> <password> [role]');
    process.exit(1);
  }
  if (passwordArg === undefined || passwordArg.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }
  if (!(USER_ROLES as readonly string[]).includes(roleArg)) {
    console.error(`Role must be one of: ${USER_ROLES.join(', ')}`);
    process.exit(1);
  }

  const env = loadEnv();
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  const userQueries = createUserQueries(pool);
  const { authService } = createAuthStack(env, pool);

  const email = normalizeEmail(emailArg);
  authService.assertEmailAllowed(email);

  const hash = await authService.hashPassword(passwordArg);
  const existing = await userQueries.findByEmail(email);

  if (existing !== null) {
    await pool.query(
      `UPDATE users SET password_hash = $2, role = $3, is_active = TRUE, updated_at = NOW() WHERE id = $1::uuid`,
      [existing.id, hash, roleArg],
    );
    console.log(JSON.stringify({ ok: true, action: 'updated', email, role: roleArg }));
  } else {
    const row = await userQueries.createLocalUser({
      email,
      passwordHash: hash,
      role: roleArg,
    });
    console.log(
      JSON.stringify({
        ok: true,
        action: 'created',
        id: row.id,
        email: row.email,
        role: row.role,
      }),
    );
  }

  await pool.end();
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
