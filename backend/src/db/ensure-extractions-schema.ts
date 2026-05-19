/**
 * Fail fast at startup if extractions migrations were not applied.
 */

import type { Pool } from 'pg';

const REQUIRED_COLUMNS = [
  'id',
  'user_id',
  'invoice_number',
  'cust_code',
  'extraction_data',
  'file_path',
] as const;

export async function ensureExtractionsSchema(pool: Pool): Promise<void> {
  const result = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'extractions'`,
  );

  if (result.rows.length === 0) {
    throw new Error(
      'Table "extractions" does not exist. Run: npm run db:setup (repo root) or cd backend && npm run db:migrate',
    );
  }

  const present = new Set(result.rows.map((r) => r.column_name));
  const missing = REQUIRED_COLUMNS.filter((c) => !present.has(c));
  if (missing.length > 0) {
    throw new Error(
      `Table "extractions" is missing column(s): ${missing.join(', ')}. ` +
        'Run: npm run db:setup (repo root) or cd backend && npm run db:migrate',
    );
  }
}
