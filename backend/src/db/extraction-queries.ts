/**
 * Parameterized persistence for successful Thai invoice extractions.
 */

import type { Pool, PoolClient, QueryResultRow } from 'pg';

import type { ThaiInvoiceExtraction } from '../services/thai-extraction-prompt.js';
import {
  coerceNonNegativeInt,
  prepareExtractionJsonb,
  stripNullBytes,
} from '../utils/postgres-persist.js';

/** Row shape returned by `extractions` SELECT / INSERT … RETURNING. */
interface ExtractionDbRow extends QueryResultRow {
  readonly id: string;
  readonly user_id: string;
  readonly request_id: string | null;
  readonly invoice_number: string;
  readonly cust_code: string;
  readonly extraction_data: unknown;
  readonly tokens_input: number;
  readonly tokens_output: number;
  readonly tokens_total: number;
  readonly duration_ms: number;
  readonly slow: boolean;
  readonly model_name: string;
  readonly source_mime_type: string;
  readonly source_original_filename: string;
  readonly source_file_size_bytes: number;
  readonly file_path: string | null;
  readonly created_at: Date | string;
}

export interface InsertExtractionParams {
  readonly userId: string;
  readonly requestId?: string;
  readonly invoiceNumber: string;
  readonly custCode: string;
  readonly extractionData: ThaiInvoiceExtraction;
  readonly tokensInput: number;
  readonly tokensOutput: number;
  readonly tokensTotal: number;
  readonly durationMs: number;
  readonly slow: boolean;
  readonly modelName: string;
  readonly sourceMimeType: string;
  readonly sourceOriginalFilename: string;
  readonly sourceFileSizeBytes: number;
}

export interface ExtractionRow {
  readonly id: string;
  readonly userId: string;
  readonly requestId: string | null;
  readonly invoiceNumber: string;
  readonly custCode: string;
  readonly extractionData: ThaiInvoiceExtraction;
  readonly tokensInput: number;
  readonly tokensOutput: number;
  readonly tokensTotal: number;
  readonly durationMs: number;
  readonly slow: boolean;
  readonly modelName: string;
  readonly sourceMimeType: string;
  readonly sourceOriginalFilename: string;
  readonly sourceFileSizeBytes: number;
  readonly filePath: string | null;
  readonly createdAt: string;
}

function mapRow(row: ExtractionDbRow): ExtractionRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    requestId: row.request_id === null ? null : String(row.request_id),
    invoiceNumber: String(row.invoice_number),
    custCode: String(row.cust_code),
    extractionData: row.extraction_data as ThaiInvoiceExtraction,
    tokensInput: Number(row.tokens_input),
    tokensOutput: Number(row.tokens_output),
    tokensTotal: Number(row.tokens_total),
    durationMs: Number(row.duration_ms),
    slow: Boolean(row.slow),
    modelName: String(row.model_name),
    sourceMimeType: String(row.source_mime_type),
    sourceOriginalFilename: String(row.source_original_filename),
    sourceFileSizeBytes: Number(row.source_file_size_bytes),
    filePath: row.file_path === null ? null : String(row.file_path),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

export interface TokenUsageSummary {
  readonly extractionCount: number;
  readonly tokensInput: number;
  readonly tokensOutput: number;
  readonly tokensTotal: number;
  readonly estimatedCostUsd: number;
  readonly periodDays: number;
}

export interface ExtractionQueries {
  insertExtraction(params: InsertExtractionParams): Promise<ExtractionRow>;
  getTokenUsageSummary(
    userId: string,
    options?: {
      readonly days?: number;
      readonly inputCostPerMillionUsd?: number;
      readonly outputCostPerMillionUsd?: number;
    },
  ): Promise<TokenUsageSummary>;
  /** Returns the most recent row for the given invoice number, if any. */
  getExtractionByInvoiceNumber(
    invoiceNumber: string,
  ): Promise<ExtractionRow | null>;
  listExtractions(
    userId: string,
    options?: { readonly limit?: number },
  ): Promise<ReadonlyArray<ExtractionRow>>;
  /** Single row only when `id` belongs to `userId` (no cross-tenant reads). */
  getExtractionByIdForUser(
    id: string,
    userId: string,
  ): Promise<ExtractionRow | null>;
  updateFilePathForUser(
    id: string,
    userId: string,
    filePath: string,
  ): Promise<boolean>;
}

const INSERT_SQL = `
INSERT INTO extractions (
  user_id,
  request_id,
  invoice_number,
  cust_code,
  extraction_data,
  tokens_input,
  tokens_output,
  tokens_total,
  duration_ms,
  slow,
  model_name,
  source_mime_type,
  source_original_filename,
  source_file_size_bytes,
  file_path
) VALUES (
  $1, $2, $3, $4, $5::jsonb,
  $6, $7, $8, $9, $10,
  $11, $12, $13, $14, $15
)
RETURNING
  id,
  user_id,
  request_id,
  invoice_number,
  cust_code,
  extraction_data,
  tokens_input,
  tokens_output,
  tokens_total,
  duration_ms,
  slow,
  model_name,
  source_mime_type,
  source_original_filename,
  source_file_size_bytes,
  file_path,
  created_at
`;

const SELECT_BY_INVOICE_LATEST = `
SELECT
  id,
  user_id,
  request_id,
  invoice_number,
  cust_code,
  extraction_data,
  tokens_input,
  tokens_output,
  tokens_total,
  duration_ms,
  slow,
  model_name,
  source_mime_type,
  source_original_filename,
  source_file_size_bytes,
  file_path,
  created_at
FROM extractions
WHERE invoice_number = $1
ORDER BY created_at DESC
LIMIT 1
`;

const LIST_BY_USER = `
SELECT
  id,
  user_id,
  request_id,
  invoice_number,
  cust_code,
  extraction_data,
  tokens_input,
  tokens_output,
  tokens_total,
  duration_ms,
  slow,
  model_name,
  source_mime_type,
  source_original_filename,
  source_file_size_bytes,
  file_path,
  created_at
FROM extractions
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2
`;

const UPDATE_FILE_PATH_FOR_USER = `
UPDATE extractions
SET file_path = $3
WHERE id = $1::uuid AND user_id = $2
`;

const USAGE_SUMMARY_FOR_USER = `
SELECT
  COUNT(*)::int AS extraction_count,
  COALESCE(SUM(tokens_input), 0)::bigint AS tokens_input,
  COALESCE(SUM(tokens_output), 0)::bigint AS tokens_output,
  COALESCE(SUM(tokens_total), 0)::bigint AS tokens_total
FROM extractions
WHERE user_id = $1
  AND created_at >= NOW() - ($2::int * INTERVAL '1 day')
`;

const SELECT_BY_ID_FOR_USER = `
SELECT
  id,
  user_id,
  request_id,
  invoice_number,
  cust_code,
  extraction_data,
  tokens_input,
  tokens_output,
  tokens_total,
  duration_ms,
  slow,
  model_name,
  source_mime_type,
  source_original_filename,
  source_file_size_bytes,
  file_path,
  created_at
FROM extractions
WHERE id = $1::uuid AND user_id = $2
LIMIT 1
`;

async function runQuery(
  executor: Pool | PoolClient,
  text: string,
  values: ReadonlyArray<unknown>,
): Promise<ExtractionDbRow> {
  const result = await executor.query<ExtractionDbRow>(text, [...values]);
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error('[extraction-queries] Expected exactly one row');
  }
  return row;
}

/**
 * Factory for extraction persistence using a shared `pg.Pool`.
 */
export function createExtractionQueries(pool: Pool): ExtractionQueries {
  return {
    async insertExtraction(params: InsertExtractionParams): Promise<ExtractionRow> {
      const extractionJson = prepareExtractionJsonb(params.extractionData);
      const row = await runQuery(pool, INSERT_SQL, [
        params.userId,
        params.requestId ?? null,
        stripNullBytes(params.invoiceNumber),
        stripNullBytes(params.custCode),
        extractionJson,
        coerceNonNegativeInt(params.tokensInput),
        coerceNonNegativeInt(params.tokensOutput),
        coerceNonNegativeInt(params.tokensTotal),
        coerceNonNegativeInt(params.durationMs),
        params.slow,
        params.modelName,
        params.sourceMimeType,
        stripNullBytes(params.sourceOriginalFilename),
        coerceNonNegativeInt(params.sourceFileSizeBytes),
        null,
      ]);
      return mapRow(row);
    },

    async updateFilePathForUser(
      id: string,
      userId: string,
      filePath: string,
    ): Promise<boolean> {
      const result = await pool.query(UPDATE_FILE_PATH_FOR_USER, [
        id,
        userId,
        filePath,
      ]);
      return (result.rowCount ?? 0) > 0;
    },

    async getExtractionByInvoiceNumber(
      invoiceNumber: string,
    ): Promise<ExtractionRow | null> {
      const result = await pool.query<ExtractionDbRow>(SELECT_BY_INVOICE_LATEST, [
        invoiceNumber,
      ]);
      const row = result.rows[0];
      if (row === undefined) {
        return null;
      }
      return mapRow(row);
    },

    async listExtractions(
      userId: string,
      options?: { readonly limit?: number },
    ): Promise<ReadonlyArray<ExtractionRow>> {
      const limit =
        options?.limit !== undefined && options.limit > 0
          ? Math.min(options.limit, 500)
          : 50;
      const result = await pool.query<ExtractionDbRow>(LIST_BY_USER, [userId, limit]);
      return result.rows.map((r: ExtractionDbRow) => mapRow(r));
    },

    async getExtractionByIdForUser(
      id: string,
      userId: string,
    ): Promise<ExtractionRow | null> {
      const result = await pool.query<ExtractionDbRow>(SELECT_BY_ID_FOR_USER, [
        id,
        userId,
      ]);
      const row = result.rows[0];
      if (row === undefined) {
        return null;
      }
      return mapRow(row);
    },

    async getTokenUsageSummary(
      userId: string,
      options?: {
        readonly days?: number;
        readonly inputCostPerMillionUsd?: number;
        readonly outputCostPerMillionUsd?: number;
      },
    ): Promise<TokenUsageSummary> {
      const periodDays =
        options?.days !== undefined && options.days > 0
          ? Math.min(Math.floor(options.days), 365)
          : 30;
      const inputRate = options?.inputCostPerMillionUsd ?? 0;
      const outputRate = options?.outputCostPerMillionUsd ?? 0;

      interface UsageRow extends QueryResultRow {
        readonly extraction_count: number;
        readonly tokens_input: string | number;
        readonly tokens_output: string | number;
        readonly tokens_total: string | number;
      }

      const result = await pool.query<UsageRow>(USAGE_SUMMARY_FOR_USER, [
        userId,
        periodDays,
      ]);
      const row = result.rows[0];
      const extractionCount = row?.extraction_count ?? 0;
      const tokensInput = Number(row?.tokens_input ?? 0);
      const tokensOutput = Number(row?.tokens_output ?? 0);
      const tokensTotal = Number(row?.tokens_total ?? 0);
      const estimatedCostUsd =
        (tokensInput / 1_000_000) * inputRate +
        (tokensOutput / 1_000_000) * outputRate;

      return {
        extractionCount,
        tokensInput,
        tokensOutput,
        tokensTotal,
        estimatedCostUsd: Math.round(estimatedCostUsd * 1_000_000) / 1_000_000,
        periodDays,
      };
    },
  };
}
