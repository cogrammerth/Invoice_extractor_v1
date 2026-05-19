import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import jwt from 'jsonwebtoken';
import pg, { type Pool } from 'pg';
import { vi } from 'vitest';

import type { ClaudeExtractionService } from '../../src/services/claude-extraction-service.js';
import type { ThaiInvoiceExtraction } from '../../src/services/thai-extraction-prompt.js';
import { ok } from '../../src/types/result.types.js';

export const INTEGRATION_DB_URL =
  process.env['INTEGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL'];

export const integrationEnabled =
  INTEGRATION_DB_URL !== undefined &&
  INTEGRATION_DB_URL.length > 0 &&
  (INTEGRATION_DB_URL.startsWith('postgres://') ||
    INTEGRATION_DB_URL.startsWith('postgresql://'));

/** Minimal valid JPEG bytes for multer upload tests. */
export const MINIMAL_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

export const MOCK_EXTRACTION: ThaiInvoiceExtraction = {
  corner_no: '1',
  e_tax_flag: 'E-TAX',
  invoice_number: 'INT-TEST-001',
  cust_code: 'CUST-INT',
  pages: { value: '1/1', is_last_page: true },
  currency: 'THB',
  payment_method: 'เงินสด',
  net_total: '100.00',
  delivery_instructions: '',
  payment_details: { method: 'เงินสด', amount: '100.00' },
  item_descriptions: ['รายการทดสอบ'],
  received_by: 'No',
  delivery_by: 'No',
  stamp: 'No stamp',
  document_groups: [{ document_number: 'INT-TEST-001', pages: [1] }],
};

export function mintTestToken(
  sub: string,
  options?: { expired?: boolean },
): string {
  const secret = process.env['JWT_SECRET'] ?? '';
  const issuer = process.env['JWT_ISSUER'] ?? 'thai-invoice-extractor';
  const audience = process.env['JWT_AUDIENCE'] ?? 'thai-invoice-api';

  if (options?.expired === true) {
    return jwt.sign({ sub }, secret, {
      algorithm: 'HS256',
      issuer,
      audience,
      expiresIn: -10,
    });
  }

  return jwt.sign({ sub, role: 'operator' }, secret, {
    algorithm: 'HS256',
    issuer,
    audience,
    expiresIn: '1h',
  });
}

export function createMockExtractionService(): ClaudeExtractionService {
  return {
    extractInvoice: vi.fn().mockResolvedValue(
      ok({
        data: MOCK_EXTRACTION,
        tokensUsed: { input: 100, output: 50, total: 150 },
        durationMs: 120,
        slow: false,
      }),
    ),
  } as unknown as ClaudeExtractionService;
}

export async function runMigrations(pool: Pool): Promise<void> {
  const migrationsDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../src/db/migrations',
  );
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), 'utf-8');
    try {
      await pool.query(sql);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Migration ${file} failed: ${message}\n` +
          'Ensure PostgreSQL is running and run: cd backend && npm run db:migrate',
        { cause: e },
      );
    }
  }
}

/** Apply migrations and verify schema required by the current code. */
export async function ensureSchemaReady(pool: Pool): Promise<void> {
  await runMigrations(pool);

  const tableCheck = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'extractions'
     ) AS exists`,
  );
  if (tableCheck.rows[0]?.exists !== true) {
    throw new Error(
      'Table "extractions" is missing. Run: cd backend && npm run db:migrate',
    );
  }

  const columnCheck = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'extractions'
         AND column_name = 'file_path'
     ) AS exists`,
  );
  if (columnCheck.rows[0]?.exists !== true) {
    throw new Error(
      'Column extractions.file_path is missing (migration 002).\n' +
        'Run: cd backend && npm run db:migrate',
    );
  }
}

const PG_CONNECT_MAX_ATTEMPTS = 10;
const PG_CONNECT_DELAY_MS = 500;

/** Close a pool without throwing (failed connect attempts, test teardown). */
export async function safeEndPool(pool: Pool | undefined): Promise<void> {
  if (pool === undefined) {
    return;
  }
  try {
    await pool.end();
  } catch {
    /* pool may already be closed */
  }
}

/** Wait until PostgreSQL accepts connections (Docker/CI cold start). */
export async function waitForPostgres(
  connectionString: string,
): Promise<pg.Pool> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= PG_CONNECT_MAX_ATTEMPTS; attempt += 1) {
    const pool = new pg.Pool({ connectionString, max: 2 });
    try {
      await pool.query('SELECT 1');
      return pool;
    } catch (e: unknown) {
      lastError = e;
      await safeEndPool(pool);
      if (attempt < PG_CONNECT_MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, PG_CONNECT_DELAY_MS));
      }
    }
  }
  const message =
    lastError instanceof Error ? lastError.message : String(lastError);
  const isRefused =
    (lastError as NodeJS.ErrnoException | undefined)?.code === 'ECONNREFUSED' ||
    message.includes('ECONNREFUSED');

  const startHint = isRefused
    ? [
        'Nothing is listening on localhost:5432 — PostgreSQL is not running.',
        '',
        'Option A — Docker (from repo root):',
        '  npm run db:up',
        '  cd backend && npm run db:migrate && npm run test:integration',
        '',
        'Option B — PostgreSQL installed on Windows:',
        '  Install from https://www.postgresql.org/download/windows/',
        '  Create DB "invoice_extractor", then set backend/.env:',
        '  DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/invoice_extractor',
        '',
        'Option C — Cloud DB (Neon/Supabase): paste connection string as DATABASE_URL',
        '',
        'Docker credentials (if using npm run db:up):',
        '  postgresql://invoice:invoice@localhost:5432/invoice_extractor',
      ].join('\n')
    : 'Start PostgreSQL locally or fix DATABASE_URL in backend/.env';

  throw new Error(
    `Could not connect to PostgreSQL after ${PG_CONNECT_MAX_ATTEMPTS} attempts.\n` +
      `DATABASE_URL=${connectionString}\n` +
      `Last error: ${message}\n\n${startHint}`,
    { cause: lastError },
  );
}

export async function truncateExtractions(pool: Pool): Promise<void> {
  await pool.query('TRUNCATE TABLE extractions RESTART IDENTITY');
}

export async function createTempUploadDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'invoice-int-upload-'));
}

export async function removeDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
