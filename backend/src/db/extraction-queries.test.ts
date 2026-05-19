/**
 * Unit tests for `extraction-queries.ts` — no real database (mocked `pg.Pool`).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';

import { createExtractionQueries } from './extraction-queries.js';
import type { ThaiInvoiceExtraction } from '../services/thai-extraction-prompt.js';

const SAMPLE: ThaiInvoiceExtraction = {
  corner_no: '1',
  e_tax_flag: 'E-TAX',
  invoice_number: 'INV-1',
  cust_code: 'C-1',
  pages: { value: '1/1', is_last_page: true },
  currency: 'THB',
  payment_method: 'เงินสด',
  net_total: '100',
  delivery_instructions: '',
  payment_details: { method: 'เงินสด', amount: '100' },
  item_descriptions: [],
  received_by: 'No',
  delivery_by: 'No',
  stamp: 'No stamp',
  document_groups: [],
};

function sampleRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    user_id: 'u1',
    request_id: 'req-1',
    invoice_number: 'INV-1',
    cust_code: 'C-1',
    extraction_data: SAMPLE,
    tokens_input: 10,
    tokens_output: 20,
    tokens_total: 30,
    duration_ms: 100,
    slow: false,
    model_name: 'claude-test',
    source_mime_type: 'image/jpeg',
    source_original_filename: 'a.jpg',
    source_file_size_bytes: 42,
    file_path: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('createExtractionQueries', () => {
  const query = vi.fn();
  let pool: Pool;

  beforeEach(() => {
    query.mockReset();
    pool = { query } as unknown as Pool;
  });

  it('insertExtraction forwards parameterized values', async () => {
    query.mockResolvedValueOnce({ rows: [sampleRow()] });

    const q = createExtractionQueries(pool);
    const row = await q.insertExtraction({
      userId: 'u1',
      requestId: 'req-1',
      invoiceNumber: 'INV-1',
      custCode: 'C-1',
      extractionData: SAMPLE,
      tokensInput: 10,
      tokensOutput: 20,
      tokensTotal: 30,
      durationMs: 100,
      slow: false,
      modelName: 'claude-test',
      sourceMimeType: 'image/jpeg',
      sourceOriginalFilename: 'a.jpg',
      sourceFileSizeBytes: 42,
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO extractions');
    expect(params[0]).toBe('u1');
    expect(params[1]).toBe('req-1');
    expect(params[2]).toBe('INV-1');
    expect(params[3]).toBe('C-1');
    expect(params[4]).toEqual(SAMPLE);
    expect(row.id).toBe('11111111-1111-1111-1111-111111111111');
    expect(row.extractionData.invoice_number).toBe('INV-1');
  });

  it('getExtractionByInvoiceNumber returns null when no rows', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const q = createExtractionQueries(pool);
    const row = await q.getExtractionByInvoiceNumber('missing');
    expect(row).toBeNull();
  });

  it('getExtractionByInvoiceNumber maps the first row', async () => {
    query.mockResolvedValueOnce({ rows: [sampleRow({ invoice_number: 'X' })] });
    const q = createExtractionQueries(pool);
    const row = await q.getExtractionByInvoiceNumber('X');
    expect(row?.invoiceNumber).toBe('X');
    expect(query.mock.calls[0]?.[1]).toEqual(['X']);
  });

  it('listExtractions caps limit at 500', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const q = createExtractionQueries(pool);
    await q.listExtractions('u1', { limit: 9_999 });
    const params = query.mock.calls[0]?.[1] as unknown[] | undefined;
    expect(params?.[1]).toBe(500);
  });

  it('listExtractions defaults limit to 50', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const q = createExtractionQueries(pool);
    await q.listExtractions('u1');
    const params = query.mock.calls[0]?.[1] as unknown[] | undefined;
    expect(params?.[1]).toBe(50);
  });

  it('getExtractionByIdForUser returns null when no row', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const q = createExtractionQueries(pool);
    const row = await q.getExtractionByIdForUser(
      '22222222-2222-2222-2222-222222222222',
      'u1',
    );
    expect(row).toBeNull();
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('WHERE id = $1::uuid AND user_id = $2');
    expect(params).toEqual(['22222222-2222-2222-2222-222222222222', 'u1']);
  });

  it('getExtractionByIdForUser maps a row', async () => {
    query.mockResolvedValueOnce({ rows: [sampleRow({ id: '33333333-3333-3333-3333-333333333333' })] });
    const q = createExtractionQueries(pool);
    const row = await q.getExtractionByIdForUser(
      '33333333-3333-3333-3333-333333333333',
      'u1',
    );
    expect(row?.id).toBe('33333333-3333-3333-3333-333333333333');
  });

  it('getTokenUsageSummary aggregates and estimates cost', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          extraction_count: 2,
          tokens_input: '1000',
          tokens_output: '500',
          tokens_total: '1500',
        },
      ],
    });
    const q = createExtractionQueries(pool);
    const summary = await q.getTokenUsageSummary('u1', {
      days: 7,
      inputCostPerMillionUsd: 3,
      outputCostPerMillionUsd: 15,
    });
    expect(summary.extractionCount).toBe(2);
    expect(summary.tokensInput).toBe(1000);
    expect(summary.tokensOutput).toBe(500);
    expect(summary.periodDays).toBe(7);
    expect(summary.estimatedCostUsd).toBeCloseTo(0.0105, 5);
    const params = query.mock.calls[0]?.[1] as unknown[] | undefined;
    expect(params).toEqual(['u1', 7]);
  });
});
