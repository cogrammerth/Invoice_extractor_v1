/**
 * List users in the database (email, role — no passwords).
 * Usage: DATABASE_PUBLIC_URL=... node scripts/list-users.mjs
 * Or:    railway link -s Postgres && railway run node scripts/list-users.mjs
 */

import pg from 'pg';

import { resolveDatabaseUrl } from './resolve-database-url.mjs';

const url = resolveDatabaseUrl();
if (!url) {
  console.error(
    'Set DATABASE_URL or DATABASE_PUBLIC_URL (Railway Postgres → Variables → DATABASE_PUBLIC_URL)',
  );
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'users'`,
  );
  if (tables.rows.length === 0) {
    console.log(
      JSON.stringify({
        ok: false,
        message: 'Table "users" does not exist. Run migrations first.',
        users: [],
      }),
    );
    process.exit(1);
  }

  const result = await client.query(
    `SELECT email, role, auth_provider, is_active, created_at
     FROM users ORDER BY created_at`,
  );
  console.log(
    JSON.stringify({ ok: true, count: result.rows.length, users: result.rows }, null, 2),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
