/**
 * Claude (Anthropic) Extraction Service
 *
 * Path: backend/src/services/claude-extraction-service.ts
 *
 * The AI-facing service for Thai invoice image extraction via the Anthropic
 * Messages API (vision). Behaviour mirrors the former Gemini service:
 * prompt + image → text → JSON parse → Zod validation → `Result<T, E>`.
 *
 * @see https://docs.anthropic.com/en/docs/build-with-claude/vision
 */

import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
} from '@anthropic-ai/sdk';
import type Anthropic from '@anthropic-ai/sdk';
import type { Logger } from 'winston';

import {
  THAI_EXTRACTION_PROMPT,
  thaiInvoiceExtractionSchema,
  type ThaiInvoiceExtraction,
} from './thai-extraction-prompt.js';
import {
  type ExtractionError,
  createExtractionError,
} from '../types/error.types.js';
import { type Result, ok, err } from '../types/result.types.js';

// ─── Constants ─────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MIME_TYPE = 'image/jpeg';
const PERFORMANCE_TARGET_MS = 500;
const MALFORMED_RESPONSE_PREVIEW_CHARS = 200;
/** Large enough for 14-field JSON + line items; Claude bills by tokens. */
const CLAUDE_MAX_OUTPUT_TOKENS = 16_384;

const ALLOWED_MIME_TYPES: ReadonlyArray<string> = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

// ─── Public types ──────────────────────────────────────────────────────────

export interface ClaudeExtractionServiceDeps {
  readonly anthropic: Anthropic;
  readonly modelName: string;
  readonly logger: Logger;
  readonly timeoutMs?: number;
}

export interface ExtractInvoiceInput {
  readonly imageBuffer: Buffer;
  /** Caller MUST have validated MIME + magic bytes upstream. */
  readonly mimeType?: string;
  readonly userId: string;
  readonly requestId?: string;
}

export interface ExtractInvoiceOutput {
  readonly data: ThaiInvoiceExtraction;
  readonly tokensUsed: {
    readonly input: number;
    readonly output: number;
    readonly total: number;
  };
  readonly durationMs: number;
  readonly slow: boolean;
}

// ─── Service ───────────────────────────────────────────────────────────────

export class ClaudeExtractionService {
  private readonly anthropic: Anthropic;
  private readonly modelName: string;
  private readonly logger: Logger;
  private readonly timeoutMs: number;

  constructor(deps: ClaudeExtractionServiceDeps) {
    this.anthropic = deps.anthropic;
    this.modelName = deps.modelName;
    this.logger = deps.logger;
    this.timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Extract the 14 Thai invoice fields from a single image via Claude Vision.
   *
   * @example
   *   const r = await service.extractInvoice({ imageBuffer: buf, userId });
   *   if (!r.success) return res.status(r.error.httpStatus ?? 500).json(r.error);
   */
  public async extractInvoice(
    input: ExtractInvoiceInput,
  ): Promise<Result<ExtractInvoiceOutput, ExtractionError>> {
    const start = performance.now();

    const guard = this.validateInput(input);
    if (!guard.success) {
      this.logFailure(input, guard.error, performance.now() - start);
      return guard;
    }

    let rawText: string;
    let tokensUsed: ExtractInvoiceOutput['tokensUsed'];
    try {
      const callResult = await this.callClaude(input);
      rawText = callResult.text;
      tokensUsed = callResult.tokensUsed;
    } catch (error) {
      const classified = this.classifyUpstreamError(error);
      this.logFailure(input, classified, performance.now() - start);
      return err(classified);
    }

    const parsed = this.parseAndValidate(rawText);
    if (!parsed.success) {
      this.logFailure(input, parsed.error, performance.now() - start);
      return parsed;
    }

    const durationMs = performance.now() - start;
    const output: ExtractInvoiceOutput = {
      data: parsed.data,
      tokensUsed,
      durationMs,
      slow: durationMs > PERFORMANCE_TARGET_MS,
    };

    this.logger.info('Extraction succeeded', {
      userId: input.userId,
      requestId: input.requestId,
      invoiceNumber: parsed.data.invoice_number,
      custCode: parsed.data.cust_code,
      durationMs,
      slow: output.slow,
      tokensTotal: tokensUsed.total,
    });

    return ok(output);
  }

  private validateInput(
    input: ExtractInvoiceInput,
  ): Result<true, ExtractionError> {
    if (input.imageBuffer.length === 0) {
      return err(
        createExtractionError('INVALID_IMAGE', 'Image buffer is empty'),
      );
    }
    const mime = input.mimeType ?? DEFAULT_MIME_TYPE;
    if (!ALLOWED_MIME_TYPES.includes(mime)) {
      return err(
        createExtractionError(
          'INVALID_IMAGE',
          `Unsupported MIME type: ${mime}`,
          { context: { mimeType: mime } },
        ),
      );
    }
    return ok(true);
  }

  private async callClaude(
    input: ExtractInvoiceInput,
  ): Promise<{ text: string; tokensUsed: ExtractInvoiceOutput['tokensUsed'] }> {
    const mediaType = toAnthropicImageMediaType(
      input.mimeType ?? DEFAULT_MIME_TYPE,
    );
    const base64 = input.imageBuffer.toString('base64');

    const imageBlock: Anthropic.ImageBlockParam = {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: base64,
      },
    };

    const message = await withTimeout(
      this.anthropic.messages.create({
        model: this.modelName,
        max_tokens: CLAUDE_MAX_OUTPUT_TOKENS,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: THAI_EXTRACTION_PROMPT },
              imageBlock,
            ],
          },
        ],
      }),
      this.timeoutMs,
    );

    const text = extractAssistantText(message);
    const tokensUsed = extractTokenUsage(message.usage);

    return { text, tokensUsed };
  }

  private parseAndValidate(
    rawText: string,
  ): Result<ThaiInvoiceExtraction, ExtractionError> {
    const cleaned = stripJsonFences(rawText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return err(
        createExtractionError(
          'MALFORMED_RESPONSE',
          'Claude response was not valid JSON',
          {
            context: {
              preview: cleaned.slice(0, MALFORMED_RESPONSE_PREVIEW_CHARS),
            },
          },
        ),
      );
    }

    const validation = thaiInvoiceExtractionSchema.safeParse(parsed);
    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((issue) => ({
        field: issue.path.join('.') || '<root>',
        message: issue.message,
      }));
      return err(
        createExtractionError(
          'VALIDATION_ERROR',
          'Extracted invoice failed schema validation',
          { fieldErrors },
        ),
      );
    }

    return ok(validation.data);
  }

  private classifyUpstreamError(error: unknown): ExtractionError {
    if (error instanceof TimeoutError) {
      return createExtractionError('TIMEOUT', error.message);
    }

    if (error instanceof APIConnectionTimeoutError) {
      return createExtractionError('TIMEOUT', error.message);
    }

    if (error instanceof APIConnectionError) {
      return createExtractionError('NETWORK_ERROR', error.message);
    }

    if (error instanceof APIError && typeof error.status === 'number') {
      const status = error.status;
      const message = error.message;
      if (status === 429) return createExtractionError('RATE_LIMIT', message);
      if (status === 403) return createExtractionError('QUOTA_EXCEEDED', message);
      if (status === 401) {
        return createExtractionError('INVALID_API_KEY', message);
      }
      if (status >= 500 && status < 600) {
        return createExtractionError('SERVER_ERROR', message);
      }
      return createExtractionError('SERVER_ERROR', message, {
        context: { originalStatus: status },
      });
    }

    const message = error instanceof Error ? error.message : String(error);
    if (isNetworkError(message)) {
      return createExtractionError('NETWORK_ERROR', message);
    }

    return createExtractionError('SERVER_ERROR', message);
  }

  private logFailure(
    input: ExtractInvoiceInput,
    error: ExtractionError,
    durationMs: number,
  ): void {
    this.logger.error('Extraction failed', {
      userId: input.userId,
      requestId: input.requestId,
      errorType: error.type,
      message: error.message,
      retryable: error.retryable,
      durationMs,
      fieldErrors: error.fieldErrors,
    });
  }
}

// ─── Module-private helpers ────────────────────────────────────────────────

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new TimeoutError(`Claude API call exceeded ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

function toAnthropicImageMediaType(
  mime: string,
): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  if (mime === 'image/jpg') return 'image/jpeg';
  if (
    mime === 'image/jpeg' ||
    mime === 'image/png' ||
    mime === 'image/gif' ||
    mime === 'image/webp'
  ) {
    return mime;
  }
  return 'image/jpeg';
}

function extractAssistantText(message: Anthropic.Messages.Message): string {
  const parts: string[] = [];
  for (const block of message.content) {
    if (block.type === 'text') {
      parts.push(block.text);
    }
  }
  return parts.join('').trim();
}

function extractTokenUsage(
  usage: Anthropic.Messages.Usage | undefined,
): ExtractInvoiceOutput['tokensUsed'] {
  if (usage === undefined) {
    return { input: 0, output: 0, total: 0 };
  }
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  return { input, output, total: input + output };
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}

const NETWORK_ERROR_NEEDLES: ReadonlyArray<string> = [
  'econnreset',
  'econnrefused',
  'enotfound',
  'etimedout',
  'network',
  'fetch failed',
  'socket hang up',
];

function isNetworkError(message: string): boolean {
  const lower = message.toLowerCase();
  return NETWORK_ERROR_NEEDLES.some((needle) => lower.includes(needle));
}
