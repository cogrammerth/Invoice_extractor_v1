/**
 * Thai Invoice Extraction Prompt + Validation Schema
 *
 * Path: backend/src/services/thai-extraction-prompt.ts
 *
 * Source of truth for the vision-LLM prompt used to extract the 14 fields
 * defined in `backend/src/prompts/thai-invoice-extraction.prompt.txt`.
 *
 * This module:
 *  1. Loads the raw human-readable prompt from the sibling `.txt` file once
 *     at module-init (UTF-8, synchronous, fail-fast on missing file).
 *  2. Appends a strict JSON output contract so the model returns parseable JSON
 *     with deterministic keys and value types.
 *  3. Exports a Zod schema that validates the model response at runtime,
 *     per `.cursor/rules/00-core.md` — runtime validation of all external data.
 *  4. Derives the `ThaiInvoiceExtraction` TypeScript type from the schema via
 *     `z.infer`, guaranteeing the compile-time type and runtime validator
 *     stay in lock-step (single source of truth).
 *
 * BUILD NOTE
 * ----------
 * The TypeScript build pipeline MUST copy `backend/src/prompts/` to the
 * compiled output directory (e.g. `backend/dist/prompts/`) so this module can
 * locate the `.txt` file at runtime. Recommended tools: `copyfiles`,
 * `tsc-alias`, or an npm `postbuild` script.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// ─── Constants ──────────────────────────────────────────────────────────────

const PROMPT_FILE_RELATIVE_PATH = '../prompts/thai-invoice-extraction.prompt.txt';
const PROMPT_FILE_ENCODING = 'utf-8' as const;
const PROMPT_FILE_ABSOLUTE_PATH = fileURLToPath(
  new URL(PROMPT_FILE_RELATIVE_PATH, import.meta.url),
);

const MAX_INVOICE_NUMBER_LENGTH = 255;
const MAX_CUST_CODE_LENGTH = 255;

// ─── JSON Output Contract ───────────────────────────────────────────────────
// Appended to the human-readable prompt to force the model to return strict JSON
// matching `thaiInvoiceExtractionSchema` below.

const JSON_OUTPUT_CONTRACT = `

---

# CRITICAL: OUTPUT FORMAT

You MUST return a single, valid JSON object. Do NOT include any explanation,
markdown fences, code blocks, or surrounding text.

The JSON object MUST contain these exact keys with these exact value types:

{
  "corner_no":             "string  (digits only; empty string if absent)",
  "e_tax_flag":            "E-TAX" | "Non E-TAX",
  "invoice_number":        "string  (REQUIRED, never empty)",
  "cust_code":             "string  (REQUIRED, exact characters, never empty)",
  "pages": {
    "value":               "string  (e.g. 1/1 or 2/3)",
    "is_last_page":        true | false
  },
  "currency":              "string",
  "payment_method":        "string",
  "net_total":             "string | null  (exact characters as shown)",
  "delivery_instructions": "string",
  "payment_details":       null | PaymentDetails,
  "item_descriptions":     ["string", ...],
  "received_by":           "Yes" | "No",
  "delivery_by":           "Yes" | "No",
  "stamp":                 "Stamp present" | "No stamp",
  "document_groups":       [{ "document_number": "string", "pages": [1, 2, 3] }]
}

Where PaymentDetails is exactly one of:

  { "method": "เงินสด",      "amount": "string" }
  { "method": "บัตรเครดิต",  "amount": "string" }
  { "method": "เงินโอน",     "transfer_details": "string", "amount": "string" }
  { "method": "เช็ค",         "cheque_number": "string", "cheque_date": "string", "amount": "string" }

# THAI TEXT PRESERVATION (NON-NEGOTIABLE)

- Return all Thai text EXACTLY as it appears, character-for-character.
- Do NOT translate, normalize, transliterate, or correct spelling.
- If text is unclear or partially blocked, return only the readable portion.
- Never guess missing characters or words; leave them blank.
`;

// ─── Prompt Loading (fail-fast at boot) ─────────────────────────────────────

function loadRawPrompt(): string {
  try {
    return readFileSync(PROMPT_FILE_ABSOLUTE_PATH, PROMPT_FILE_ENCODING);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `[thai-extraction-prompt] Failed to load prompt file at ` +
        `${PROMPT_FILE_ABSOLUTE_PATH}: ${message}`,
    );
  }
}

/**
 * The complete prompt sent to the vision model: human-readable instructions from
 * `thai-invoice-extraction.prompt.txt` followed by a strict JSON output
 * contract that mirrors `thaiInvoiceExtractionSchema`.
 *
 * Loaded once at module init.
 *
 * @example
 * import { THAI_EXTRACTION_PROMPT } from './thai-extraction-prompt';
 * const result = await model.generateContent([THAI_EXTRACTION_PROMPT, imagePart]);
 */
export const THAI_EXTRACTION_PROMPT: string =
  loadRawPrompt().trimEnd() + JSON_OUTPUT_CONTRACT;

// ─── Zod Sub-schemas ────────────────────────────────────────────────────────

/** Task 5 — PAGES marker (e.g. "1/3") and whether this is the final page. */
const pagesSchema = z.object({
  value: z.string(),
  is_last_page: z.boolean(),
});

/**
 * Task 9 — `ชำระเงินโดย` payment-method checkbox group.
 * Modelled as a discriminated union so each ticked method carries exactly
 * the additional fields required for it (e.g. cheque number for `เช็ค`).
 */
const paymentDetailsSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('เงินสด'),
    amount: z.string(),
  }),
  z.object({
    method: z.literal('บัตรเครดิต'),
    amount: z.string(),
  }),
  z.object({
    method: z.literal('เงินโอน'),
    transfer_details: z.string(),
    amount: z.string(),
  }),
  z.object({
    method: z.literal('เช็ค'),
    cheque_number: z.string(),
    cheque_date: z.string(),
    amount: z.string(),
  }),
]);

/** Task 14 — multi-page document grouping (one document number, N pages). */
const documentGroupSchema = z.object({
  document_number: z.string().min(1),
  pages: z.array(z.number().int().positive()),
});

// ─── Main Schema (14 fields, one per prompt task) ───────────────────────────

/**
 * Zod schema covering all 14 extraction tasks defined in
 * `thai-invoice-extraction.prompt.txt`.
 *
 * Use this to validate the model's JSON response before passing data downstream.
 * Mismatches map to the `MALFORMED_RESPONSE` error classification defined in
 * `.cursorrules` (one of the 9 error types).
 *
 * @example
 * const parsed = thaiInvoiceExtractionSchema.safeParse(JSON.parse(rawResponse));
 * if (!parsed.success) {
 *   logger.error('Model returned malformed response', {
 *     issues: parsed.error.issues,
 *   });
 *   return { success: false, error: 'MALFORMED_RESPONSE' };
 * }
 * return { success: true, data: parsed.data };
 */
export const thaiInvoiceExtractionSchema = z.object({
  // Task 1 — number after "No." in the document corner (digits-only or empty)
  corner_no: z.string().regex(/^\d*$/, 'corner_no must be digits or empty'),

  // Task 2 — E-TAX flag above the barcode
  e_tax_flag: z.enum(['E-TAX', 'Non E-TAX']),

  // Task 3 — Invoice Number (REQUIRED per .cursorrules DB constraints)
  invoice_number: z
    .string()
    .min(1, 'invoice_number is required')
    .max(MAX_INVOICE_NUMBER_LENGTH, 'invoice_number exceeds 255 chars'),

  // Task 4 — CUST CODE (REQUIRED, exact characters, no correction)
  cust_code: z
    .string()
    .min(1, 'cust_code is required')
    .max(MAX_CUST_CODE_LENGTH, 'cust_code exceeds 255 chars'),

  // Task 5 — PAGES marker + last-page flag
  pages: pagesSchema,

  // Task 6 — CURRENCY and PAYMENT METHOD (as printed on the document header)
  currency: z.string(),
  payment_method: z.string(),

  // Task 7 — Net Total preserved as string to retain exact formatting
  // (commas, currency symbols, decimal style). Numeric parsing is the
  // responsibility of the downstream persistence layer.
  net_total: z.string().nullable(),

  // Task 8 — free-form Delivery Instructions block
  delivery_instructions: z.string(),

  // Task 9 — ชำระเงินโดย payment-method discriminated union (nullable when
  // no checkbox is ticked or the section is absent)
  payment_details: paymentDetailsSchema.nullable(),

  // Task 10 — all ITEM DESCRIPTION rows in document order, exact characters
  item_descriptions: z.array(z.string()),

  // Task 11 — RECEIVED BY signature + date present?
  received_by: z.enum(['Yes', 'No']),

  // Task 12 — DELIVERY BY signature + date present?
  delivery_by: z.enum(['Yes', 'No']),

  // Task 13 — document stamp present? (typically blue ink, anywhere on page)
  stamp: z.enum(['Stamp present', 'No stamp']),

  // Task 14 — multi-page document groupings for batch processing
  document_groups: z.array(documentGroupSchema),
});

// ─── Inferred TypeScript types ──────────────────────────────────────────────

/**
 * Strict TypeScript type for a single validated extraction result.
 *
 * Derived from `thaiInvoiceExtractionSchema` via `z.infer` so the compile-time
 * type and runtime validator can never drift.
 *
 * @example
 * function persist(invoice: ThaiInvoiceExtraction): Promise<void> {
 *   // invoice.invoice_number and invoice.cust_code are guaranteed non-empty
 * }
 */
export type ThaiInvoiceExtraction = z.infer<typeof thaiInvoiceExtractionSchema>;

/** Discriminated payment-details union (task 9). */
export type PaymentDetails = z.infer<typeof paymentDetailsSchema>;

/** Page-marker shape (task 5). */
export type PagesMarker = z.infer<typeof pagesSchema>;

/** Multi-page document group (task 14). */
export type DocumentGroup = z.infer<typeof documentGroupSchema>;

export default THAI_EXTRACTION_PROMPT;
