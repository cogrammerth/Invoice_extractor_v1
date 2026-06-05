/**
 * Create or update a user — only needs DATABASE_URL / DATABASE_PUBLIC_URL + bcrypt.
 * Usage: node scripts/seed-user-prod.mjs email password [role]
 */

import bcrypt from 'bcrypt';
import pg from 'pg';

import { resolveDatabaseUrl } from './resolve-database-url.mjs';

const ROLES = ['admin', 'operator', 'viewer'];
const BCRYPT_ROUNDS = 12;

const email = process.argv[2]?.trim().toLowerCase();
const password = process.argv[3];
const role = (process.argv[4]?.trim() ?? 'admin');

if (!email) {
  console.error('Usage: node scripts/seed-user-prod.mjs <email> <password> [role]');
  process.exit(1);
}
if (!password || password.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}
if (!ROLES.includes(role)) {
  console.error(`Role must be one of: ${ROLES.join(', ')}`);
  process.exit(1);
}

const url = resolveDatabaseUrl();
if (!url) {
  console.error('Set DATABASE_URL or DATABASE_PUBLIC_URL');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const existing = await client.query(
    `SELECT id FROM users WHERE email = $1 LIMIT 1`,
    [email],
  );

  if (existing.rows.length > 0) {
    const id = existing.rows[0].id;
    await client.query(
      `UPDATE users SET password_hash = $2, role = $3, is_active = TRUE, updated_at = NOW()
       WHERE id = $1::uuid`,
      [id, hash, role],
    );
    console.log(JSON.stringify({ ok: true, action: 'updated', email, role }));
  } else {
    const inserted = await client.query(
      `INSERT INTO users (email, password_hash, role, auth_provider, is_active)
       VALUES ($1, $2, $3, 'local', TRUE)
       RETURNING id, email, role`,
      [email, hash, role],
    );
    const row = inserted.rows[0];
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
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
