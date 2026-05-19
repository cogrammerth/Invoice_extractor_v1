/**
 * Vitest suite for `thai-extraction-prompt.ts`.
 *
 * Path: backend/src/services/thai-extraction-prompt.test.ts
 *
 * Covers the five cases mandated by `.cursor/AGENTS.md` → "Testing
 * Completeness":
 *
 *   1. Happy path           — fully-valid extraction parses.
 *   2. Edge case            — max-length invoice_number passes, 256 fails.
 *   3. Validation errors    — missing/empty required fields are rejected
 *                             with field-level issues.
 *   4. Discriminated union  — every `payment_details.method` branch parses
 *                             with its required additional fields.
 *   5. Prompt-loader        — `THAI_EXTRACTION_PROMPT` is non-empty and
 *                             contains both the source `.txt` content and
 *                             the appended JSON output contract.
 *
 * Test 5 doubles as a build-step smoke test: if `copyfiles` failed to ship
 * the `.txt` file to `dist/prompts/`, the import below throws at module
 * init and the entire suite reports a single loud failure.
 */

import { describe, it, expect } from 'vitest';

import {
  THAI_EXTRACTION_PROMPT,
  thaiInvoiceExtractionSchema,
  type ThaiInvoiceExtraction,
} from './thai-extraction-prompt';

// ─── Shared fixture: a fully-valid extraction ──────────────────────────────

const validExtraction: ThaiInvoiceExtraction = {
  corner_no: '124',
  e_tax_flag: 'E-TAX',
  invoice_number: 'IV422250803132',
  cust_code: 'CUST-0042',
  pages: { value: '1/1', is_last_page: true },
  currency: 'THB',
  payment_method: 'เงินสด',
  net_total: '1,070.00',
  delivery_instructions: 'โปรดส่งภายในวันที่ 30',
  payment_details: { method: 'เงินสด', amount: '1,070.00' },
  item_descriptions: ['กระดาษ A4 80g', 'ปากกาลูกลื่นสีดำ'],
  received_by: 'Yes',
  delivery_by: 'No',
  stamp: 'Stamp present',
  document_groups: [{ document_number: 'IV422250803132', pages: [1, 2, 3] }],
};

// ─── 5. Prompt-loader integrity (also our build-step smoke test) ───────────

describe('THAI_EXTRACTION_PROMPT (prompt loader)', () => {
  it('loads a non-empty prompt string from the .txt file', () => {
    expect(typeof THAI_EXTRACTION_PROMPT).toBe('string');
    expect(THAI_EXTRACTION_PROMPT.length).toBeGreaterThan(500);
  });

  it('appends the JSON output contract marker and key directives', () => {
    expect(THAI_EXTRACTION_PROMPT).toContain('CRITICAL: OUTPUT FORMAT');
    expect(THAI_EXTRACTION_PROMPT).toContain('"invoice_number"');
    expect(THAI_EXTRACTION_PROMPT).toContain('"cust_code"');
    expect(THAI_EXTRACTION_PROMPT).toContain('THAI TEXT PRESERVATION');
  });

  it('preserves the human-readable instructions from the .txt source', () => {
    expect(THAI_EXTRACTION_PROMPT).toContain('CUST CODE');
    expect(THAI_EXTRACTION_PROMPT).toContain('PAGES');
    expect(THAI_EXTRACTION_PROMPT).toContain('ITEM DESCRIPTION');
    expect(THAI_EXTRACTION_PROMPT).toContain('ชำระเงินโดย');
    expect(THAI_EXTRACTION_PROMPT).toContain('Document Number');
  });
});

// ─── 1. Happy path ─────────────────────────────────────────────────────────

describe('thaiInvoiceExtractionSchema — happy path', () => {
  it('accepts a fully-populated valid extraction', () => {
    const result = thaiInvoiceExtractionSchema.safeParse(validExtraction);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.invoice_number).toBe('IV422250803132');
      expect(result.data.cust_code).toBe('CUST-0042');
      expect(result.data.item_descriptions).toHaveLength(2);
      expect(result.data.document_groups[0]?.pages).toEqual([1, 2, 3]);
    }
  });
});

// ─── 2. Edge cases ─────────────────────────────────────────────────────────

describe('thaiInvoiceExtractionSchema — edge cases', () => {
  it('accepts invoice_number at exactly 255 characters', () => {
    const at255 = 'X'.repeat(255);
    const result = thaiInvoiceExtractionSchema.safeParse({
      ...validExtraction,
      invoice_number: at255,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invoice_number at 256 characters', () => {
    const at256 = 'X'.repeat(256);
    const result = thaiInvoiceExtractionSchema.safeParse({
      ...validExtraction,
      invoice_number: at256,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path[0] === 'invoice_number',
      );
      expect(issue).toBeDefined();
    }
  });

  it('accepts empty corner_no (no "No." marker on document)', () => {
    const result = thaiInvoiceExtractionSchema.safeParse({
      ...validExtraction,
      corner_no: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-numeric corner_no', () => {
    const result = thaiInvoiceExtractionSchema.safeParse({
      ...validExtraction,
      corner_no: '12A',
    });
    expect(result.success).toBe(false);
  });

  it('accepts null net_total (amount missing on document)', () => {
    const result = thaiInvoiceExtractionSchema.safeParse({
      ...validExtraction,
      net_total: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts null payment_details (no checkbox ticked)', () => {
    const result = thaiInvoiceExtractionSchema.safeParse({
      ...validExtraction,
      payment_details: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty item_descriptions array', () => {
    const result = thaiInvoiceExtractionSchema.safeParse({
      ...validExtraction,
      item_descriptions: [],
    });
    expect(result.success).toBe(true);
  });
});

// ─── 3. Validation errors ──────────────────────────────────────────────────

describe('thaiInvoiceExtractionSchema — validation errors', () => {
  it('rejects missing invoice_number with a field-level issue', () => {
    const { invoice_number: _unused, ...rest } = validExtraction;
    const result = thaiInvoiceExtractionSchema.safeParse(rest);

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path[0] === 'invoice_number',
      );
      expect(issue).toBeDefined();
    }
  });

  it('rejects empty invoice_number', () => {
    const result = thaiInvoiceExtractionSchema.safeParse({
      ...validExtraction,
      invoice_number: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing cust_code', () => {
    const { cust_code: _unused, ...rest } = validExtraction;
    const result = thaiInvoiceExtractionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid e_tax_flag value', () => {
    const result = thaiInvoiceExtractionSchema.safeParse({
      ...validExtraction,
      e_tax_flag: 'UNKNOWN',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid stamp value', () => {
    const result = thaiInvoiceExtractionSchema.safeParse({
      ...validExtraction,
      stamp: 'maybe',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid received_by value', () => {
    const result = thaiInvoiceExtractionSchema.safeParse({
      ...validExtraction,
      received_by: 'sometimes',
    });
    expect(result.success).toBe(false);
  });
});

// ─── 4. Discriminated payment_details union (all 4 branches) ───────────────

describe('thaiInvoiceExtractionSchema — payment_details union', () => {
  it('parses เงินสด (cash) with amount only', () => {
    const result = thaiInvoiceExtractionSchema.safeParse({
      ...validExtraction,
      payment_details: { method: 'เงินสด', amount: '500.00' },
    });
    expect(result.success).toBe(true);
  });

  it('parses บัตรเครดิต (credit card) with amount only', () => {
    const result = thaiInvoiceExtractionSchema.safeParse({
      ...validExtraction,
      payment_details: { method: 'บัตรเครดิต', amount: '500.00' },
    });
    expect(result.success).toBe(true);
  });

  it('parses เงินโอน (transfer) with transfer_details + amount', () => {
    const result = thaiInvoiceExtractionSchema.safeParse({
      ...validExtraction,
      payment_details: {
        method: 'เงินโอน',
        transfer_details: 'SCB 123-4-56789',
        amount: '500.00',
      },
    });
    expect(result.success).toBe(true);
  });

  it('parses เช็ค (cheque) with cheque_number + cheque_date + amount', () => {
    const result = thaiInvoiceExtractionSchema.safeParse({
      ...validExtraction,
      payment_details: {
        method: 'เช็ค',
        cheque_number: 'CHQ-0001',
        cheque_date: '2026-05-13',
        amount: '500.00',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects เงินโอน missing transfer_details', () => {
    const result = thaiInvoiceExtractionSchema.safeParse({
      ...validExtraction,
      payment_details: { method: 'เงินโอน', amount: '500.00' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects เช็ค missing cheque_number', () => {
    const result = thaiInvoiceExtractionSchema.safeParse({
      ...validExtraction,
      payment_details: {
        method: 'เช็ค',
        cheque_date: '2026-05-13',
        amount: '500.00',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown payment method', () => {
    const result = thaiInvoiceExtractionSchema.safeParse({
      ...validExtraction,
      payment_details: { method: 'บิตคอยน์', amount: '500.00' },
    });
    expect(result.success).toBe(false);
  });
});
