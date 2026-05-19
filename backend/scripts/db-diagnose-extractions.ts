/**
 * Diagnose extractions table schema and test insert (local debugging).
 * Usage: cd backend && npx tsx scripts/db-diagnose-extractions.ts
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import pg from 'pg';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(scriptDir, '..', '.env'), override: true });

const url = process.env['DATABASE_URL'];
if (url === undefined || url.length === 0) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function main(): Promise<void> {
  const pool = new pg.Pool({ connectionString: url });
  try {
    const cols = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'extractions'
       ORDER BY ordinal_position`,
    );
    console.log('extractions columns:', cols.rows.map((r) => r.column_name));

    const hasFilePath = cols.rows.some((r) => r.column_name === 'file_path');
    if (!hasFilePath) {
      console.error(
        '\nMISSING file_path column. Run: npm run db:migrate (from backend/) or npm run db:setup (repo root)',
      );
      process.exit(1);
    }

    const testId = await pool.query<{ id: string }>(
      `INSERT INTO extractions (
        user_id, invoice_number, cust_code, extraction_data,
        tokens_input, tokens_output, tokens_total, duration_ms, slow,
        model_name, source_mime_type, source_original_filename,
        source_file_size_bytes, file_path
      ) VALUES (
        $1, $2, $3, $4::jsonb,
        $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14
      ) RETURNING id`,
      [
        'diagnose-test-user',
        'DIAG-INV',
        'DIAG-CUST',
        JSON.stringify({ invoice_number: 'DIAG-INV', cust_code: 'DIAG-CUST' }),
        1,
        1,
        2,
        1,
        false,
        'diagnose',
        'image/jpeg',
        'test.jpg',
        1,
        null,
      ],
    );
    const id = testId.rows[0]?.id;
    if (id !== undefined) {
      await pool.query('DELETE FROM extractions WHERE id = $1::uuid', [id]);
    }
    console.log('\nTest insert: OK');
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string; detail?: string };
    console.error('\nTest insert FAILED:', err.message);
    if (err.code !== undefined) {
      console.error('PostgreSQL code:', err.code);
    }
    if (err.detail !== undefined) {
      console.error('Detail:', err.detail);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void main();
