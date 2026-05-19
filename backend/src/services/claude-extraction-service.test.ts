/**
 * Vitest suite for `claude-extraction-service.ts`.
 *
 * No real Anthropic API calls — `Anthropic` is mocked via dependency injection.
 */

import { describe, it, expect, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import {
  AuthenticationError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import type { Logger } from 'winston';

import { ClaudeExtractionService } from './claude-extraction-service.js';
import type { ThaiInvoiceExtraction } from './thai-extraction-prompt.js';

const VALID_EXTRACTION: ThaiInvoiceExtraction = {
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
  item_descriptions: ['กระดาษ A4 80g'],
  received_by: 'Yes',
  delivery_by: 'No',
  stamp: 'Stamp present',
  document_groups: [{ document_number: 'IV422250803132', pages: [1] }],
};

const SAMPLE_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const SAMPLE_INPUT = {
  imageBuffer: SAMPLE_BUFFER,
  userId: 'user-test-1',
  requestId: 'req-test-1',
};

function makeMockLogger(): Logger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  } as unknown as Logger;
}

interface MockClientOptions {
  responseText?: string;
  rejectWith?: unknown;
  delayMs?: number;
  usage?: { input_tokens: number; output_tokens: number };
  /** When true, mock message has no `usage` field (SDK edge case). */
  omitUsage?: boolean;
}

function makeMockAnthropic(opts: MockClientOptions): Anthropic {
  const create = vi.fn(async () => {
    if (opts.delayMs !== undefined && opts.delayMs > 0) {
      await new Promise((r) => setTimeout(r, opts.delayMs));
    }
    if (opts.rejectWith !== undefined) {
      throw opts.rejectWith;
    }
    const text = opts.responseText ?? '';
    const base = {
      id: 'msg_test',
      type: 'message' as const,
      role: 'assistant' as const,
      content: [{ type: 'text' as const, text }],
      model: 'claude-test',
      stop_reason: 'end_turn' as const,
    };
    if (opts.omitUsage === true) {
      return base;
    }
    const usage = opts.usage ?? { input_tokens: 0, output_tokens: 0 };
    return {
      ...base,
      usage: {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
      },
    };
  });

  return {
    messages: { create },
  } as unknown as Anthropic;
}

function makeService(opts: MockClientOptions, timeoutMs?: number) {
  return new ClaudeExtractionService({
    anthropic: makeMockAnthropic(opts),
    modelName: 'claude-sonnet-4-6',
    logger: makeMockLogger(),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  });
}

describe('ClaudeExtractionService — happy path', () => {
  it('returns Result.ok with parsed extraction for a valid response', async () => {
    const service = makeService({
      responseText: JSON.stringify(VALID_EXTRACTION),
      usage: { input_tokens: 1500, output_tokens: 100 },
    });

    const result = await service.extractInvoice(SAMPLE_INPUT);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data.invoice_number).toBe('IV422250803132');
      expect(result.data.tokensUsed).toEqual({
        input: 1500,
        output: 100,
        total: 1600,
      });
    }
  });

  it('strips ```json fences from the response', async () => {
    const fenced = '```json\n' + JSON.stringify(VALID_EXTRACTION) + '\n```';
    const service = makeService({ responseText: fenced });

    const result = await service.extractInvoice(SAMPLE_INPUT);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data.invoice_number).toBe('IV422250803132');
    }
  });

  it('defaults tokensUsed to zeros when usage is absent', async () => {
    const service = makeService({
      responseText: JSON.stringify(VALID_EXTRACTION),
      omitUsage: true,
    });

    const result = await service.extractInvoice(SAMPLE_INPUT);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tokensUsed).toEqual({
        input: 0,
        output: 0,
        total: 0,
      });
    }
  });
});

describe('ClaudeExtractionService — edge cases', () => {
  it('rejects an empty image buffer with INVALID_IMAGE', async () => {
    const service = makeService({
      responseText: JSON.stringify(VALID_EXTRACTION),
    });

    const result = await service.extractInvoice({
      ...SAMPLE_INPUT,
      imageBuffer: Buffer.alloc(0),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('INVALID_IMAGE');
    }
  });

  it('rejects an unsupported MIME type with INVALID_IMAGE', async () => {
    const service = makeService({
      responseText: JSON.stringify(VALID_EXTRACTION),
    });

    const result = await service.extractInvoice({
      ...SAMPLE_INPUT,
      mimeType: 'application/x-shockwave-flash',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('INVALID_IMAGE');
    }
  });
});

describe('ClaudeExtractionService — validation errors', () => {
  it('returns VALIDATION_ERROR when invoice_number is missing', async () => {
    const { invoice_number: _drop, ...missing } = VALID_EXTRACTION;
    const service = makeService({ responseText: JSON.stringify(missing) });

    const result = await service.extractInvoice(SAMPLE_INPUT);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('VALIDATION_ERROR');
      const fields = result.error.fieldErrors?.map((f) => f.field) ?? [];
      expect(fields).toContain('invoice_number');
    }
  });

  it('returns MALFORMED_RESPONSE when Claude returns non-JSON', async () => {
    const service = makeService({ responseText: 'not json' });

    const result = await service.extractInvoice(SAMPLE_INPUT);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('MALFORMED_RESPONSE');
    }
  });
});

describe('ClaudeExtractionService — upstream error classification', () => {
  const headers = new Headers();

  it('classifies 429 as RATE_LIMIT', async () => {
    const service = makeService({
      rejectWith: new RateLimitError(429, {}, 'Too many', headers),
    });
    const result = await service.extractInvoice(SAMPLE_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.type).toBe('RATE_LIMIT');
  });

  it('classifies 403 as QUOTA_EXCEEDED', async () => {
    const service = makeService({
      rejectWith: new PermissionDeniedError(403, {}, 'Denied', headers),
    });
    const result = await service.extractInvoice(SAMPLE_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.type).toBe('QUOTA_EXCEEDED');
  });

  it('classifies 401 as INVALID_API_KEY', async () => {
    const service = makeService({
      rejectWith: new AuthenticationError(401, {}, 'Auth', headers),
    });
    const result = await service.extractInvoice(SAMPLE_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.type).toBe('INVALID_API_KEY');
  });

  it('classifies 503 as SERVER_ERROR', async () => {
    const service = makeService({
      rejectWith: new InternalServerError(503, {}, 'Down', headers),
    });
    const result = await service.extractInvoice(SAMPLE_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.type).toBe('SERVER_ERROR');
  });

  it('classifies socket errors as NETWORK_ERROR', async () => {
    const service = makeService({
      rejectWith: new Error('connect ECONNREFUSED 127.0.0.1:443'),
    });
    const result = await service.extractInvoice(SAMPLE_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.type).toBe('NETWORK_ERROR');
  });

  it('classifies hung upstream as TIMEOUT', async () => {
    const service = makeService(
      { responseText: JSON.stringify(VALID_EXTRACTION), delayMs: 200 },
      20,
    );
    const result = await service.extractInvoice(SAMPLE_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.type).toBe('TIMEOUT');
  });
});

describe('ClaudeExtractionService — performance', () => {
  it('completes a fast mocked round-trip under the 500ms target', async () => {
    const service = makeService({
      responseText: JSON.stringify(VALID_EXTRACTION),
    });
    const start = performance.now();
    const result = await service.extractInvoice(SAMPLE_INPUT);
    const duration = performance.now() - start;

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(500);
    if (result.success) expect(result.data.slow).toBe(false);
  });
});
