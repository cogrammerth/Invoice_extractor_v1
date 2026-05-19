/**
 * Thai invoice HTTP routes
 *
 * Path: backend/src/routes/thai-invoices.ts
 *
 * JWT-protected upload + list/detail extractions; multer on `/upload` only.
 */

import { performance } from 'node:perf_hooks';

import {
  Router,
  type Request,
  type RequestHandler,
  type Response,
  type NextFunction,
} from 'express';
import multer from 'multer';
import { z } from 'zod';

import { env } from '../config/env.js';
import type { FileStorageService } from '../services/file-storage.service.js';
import {
  EXTRACTION_ERROR_METADATA,
  type ExtractionError,
  type FieldError,
} from '../types/error.types.js';
import { HttpResponseError } from '../utils/http-response-error.js';
import { mapExtractionPersistError } from '../utils/postgres-persist.js';

const BYTES_PER_MEGABYTE = 1024 * 1024;
const MAX_UPLOAD_BYTES = env.MAX_FILE_SIZE_MB * BYTES_PER_MEGABYTE;

const ALLOWED_UPLOAD_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
  ): void => {
    if (ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(
      new HttpResponseError(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        `Unsupported file type: ${file.mimetype}. Allowed: ${[...ALLOWED_UPLOAD_MIME_TYPES].join(', ')}`,
      ),
    );
  },
});

export interface ThaiInvoicesRouterDeps {
  readonly jwtAuthMiddleware: RequestHandler;
  readonly uploadRateLimiter: RequestHandler;
  readonly fileStorageService: FileStorageService;
}

/**
 * Mounted at `/api/thai-invoices` — caller supplies JWT middleware for `/upload`.
 */
export function createThaiInvoicesRouter(deps: ThaiInvoicesRouterDeps): Router {
  const { fileStorageService } = deps;
  const router = Router();

  /**
   * Lightweight readiness probe for the mounted API slice.
   */
  router.get('/health', (_req: Request, res: Response): void => {
    res.status(200).json({ success: true, status: 'ok', scope: 'thai-invoices' });
  });

  /**
   * Token usage summary for the authenticated user (aggregated from `extractions`).
   * Optional query: `days` (1–365, default 30).
   */
  router.get(
    '/usage',
    deps.jwtAuthMiddleware,
    (req: Request, res: Response, next: NextFunction): void => {
      void handleGetTokenUsage(req, res, next);
    },
  );

  /**
   * List extractions for the authenticated user (`sub` = user id).
   * Optional query: `limit` (1–500, default 50 from query layer).
   */
  router.get(
    '/extractions',
    deps.jwtAuthMiddleware,
    (req: Request, res: Response, next: NextFunction): void => {
      void handleListExtractions(req, res, next);
    },
  );

  /**
   * Get one extraction by id when it belongs to the authenticated user.
   */
  router.get(
    '/extractions/:id',
    deps.jwtAuthMiddleware,
    (req: Request, res: Response, next: NextFunction): void => {
      void handleGetExtractionById(req, res, next);
    },
  );

  /**
   * Download the stored source image for an extraction (owner only).
   */
  router.get(
    '/files/:id',
    deps.jwtAuthMiddleware,
    (req: Request, res: Response, next: NextFunction): void => {
      void handleGetExtractionFile(req, res, next, deps.fileStorageService);
    },
  );

  /**
   * Upload a single invoice image for Claude vision extraction (requires Bearer JWT).
   */
  router.post(
    '/upload',
    deps.jwtAuthMiddleware,
    deps.uploadRateLimiter,
    (req: Request, res: Response, next: NextFunction): void => {
      upload.single('file')(req, res, (err: unknown) => {
        if (err !== undefined) {
          next(err);
          return;
        }
        void handleUpload(req, res, next, fileStorageService);
      });
    },
  );

  return router;
}

function requireAuthUserId(req: Request, next: NextFunction): string | null {
  const auth = req.auth;
  if (auth === undefined) {
    next(
      new HttpResponseError(
        500,
        'INTERNAL_ERROR',
        'Authentication context missing on protected route',
      ),
    );
    return null;
  }
  return auth.userId;
}

async function handleGetTokenUsage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = requireAuthUserId(req, next);
  if (userId === null) {
    return;
  }

  const daysParam = req.query['days'];
  let days: number | undefined;
  if (daysParam !== undefined) {
    const parsed = z.coerce.number().int().positive().max(365).safeParse(daysParam);
    if (!parsed.success) {
      next(
        new HttpResponseError(
          400,
          'INVALID_QUERY',
          'Query parameter "days" must be an integer between 1 and 365',
        ),
      );
      return;
    }
    days = parsed.data;
  }

  const extractionQueries = res.locals.extractionQueries;
  try {
    const summary = await extractionQueries.getTokenUsageSummary(userId, {
      days,
      inputCostPerMillionUsd: env.CLAUDE_INPUT_COST_PER_MILLION_USD,
      outputCostPerMillionUsd: env.CLAUDE_OUTPUT_COST_PER_MILLION_USD,
    });
    res.status(200).json({
      success: true,
      data: {
        summary,
        pricing: {
          inputCostPerMillionUsd: env.CLAUDE_INPUT_COST_PER_MILLION_USD,
          outputCostPerMillionUsd: env.CLAUDE_OUTPUT_COST_PER_MILLION_USD,
          modelName: env.CLAUDE_MODEL,
          note: 'Estimated cost from configured rates; not an invoice from Anthropic.',
        },
      },
    });
  } catch (e: unknown) {
    req.requestLogger?.error('Token usage summary failed', {
      message: e instanceof Error ? e.message : String(e),
      requestId: req.id,
    });
    next(
      new HttpResponseError(
        503,
        'DATABASE_ERROR',
        'Failed to load token usage. Please try again later.',
      ),
    );
  }
}

async function handleListExtractions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = requireAuthUserId(req, next);
  if (userId === null) {
    return;
  }

  const limitParam = req.query['limit'];
  let limit: number | undefined;
  if (limitParam !== undefined) {
    const parsed = z.coerce.number().int().positive().max(500).safeParse(limitParam);
    if (!parsed.success) {
      next(
        new HttpResponseError(
          400,
          'INVALID_QUERY',
          'Query parameter "limit" must be an integer between 1 and 500',
        ),
      );
      return;
    }
    limit = parsed.data;
  }

  const extractionQueries = res.locals.extractionQueries;
  try {
    const rows = await extractionQueries.listExtractions(userId, { limit });
    res.status(200).json({ success: true, data: { extractions: rows } });
  } catch (e: unknown) {
    req.requestLogger?.error('List extractions failed', {
      message: e instanceof Error ? e.message : String(e),
      requestId: req.id,
    });
    next(
      new HttpResponseError(
        503,
        'DATABASE_ERROR',
        'Failed to load extractions. Please try again later.',
      ),
    );
  }
}

async function handleGetExtractionById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = requireAuthUserId(req, next);
  if (userId === null) {
    return;
  }

  const idParse = z.string().uuid().safeParse(req.params['id']);
  if (!idParse.success) {
    next(
      new HttpResponseError(
        400,
        'INVALID_ID',
        'Extraction id must be a valid UUID',
      ),
    );
    return;
  }
  const id = idParse.data;

  const extractionQueries = res.locals.extractionQueries;
  try {
    const row = await extractionQueries.getExtractionByIdForUser(id, userId);
    if (row === null) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Extraction not found',
        },
      });
      return;
    }
    res.status(200).json({ success: true, data: { extraction: row } });
  } catch (e: unknown) {
    req.requestLogger?.error('Get extraction failed', {
      message: e instanceof Error ? e.message : String(e),
      requestId: req.id,
    });
    next(
      new HttpResponseError(
        503,
        'DATABASE_ERROR',
        'Failed to load extraction. Please try again later.',
      ),
    );
  }
}

async function handleGetExtractionFile(
  req: Request,
  res: Response,
  next: NextFunction,
  fileStorageService: FileStorageService,
): Promise<void> {
  const userId = requireAuthUserId(req, next);
  if (userId === null) {
    return;
  }

  const idParse = z.string().uuid().safeParse(req.params['id']);
  if (!idParse.success) {
    next(
      new HttpResponseError(
        400,
        'INVALID_ID',
        'Extraction id must be a valid UUID',
      ),
    );
    return;
  }
  const id = idParse.data;

  const extractionQueries = res.locals.extractionQueries;
  try {
    const row = await extractionQueries.getExtractionByIdForUser(id, userId);
    if (row === null) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Extraction not found' },
      });
      return;
    }
    if (row.filePath === null || row.filePath.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'Source file was not stored' },
      });
      return;
    }

    const buffer = await fileStorageService.readFile(id, row.filePath);
    res.setHeader('Content-Type', row.sourceMimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${row.sourceOriginalFilename.replace(/"/g, '')}"`,
    );
    res.status(200).send(buffer);
  } catch (e: unknown) {
    req.requestLogger?.error('Get extraction file failed', {
      message: e instanceof Error ? e.message : String(e),
      requestId: req.id,
    });
    next(
      new HttpResponseError(
        404,
        'FILE_NOT_FOUND',
        'Source file could not be read',
      ),
    );
  }
}

/**
 * Run extraction after multer has populated `req.file`.
 */
async function handleUpload(
  req: Request,
  res: Response,
  next: NextFunction,
  fileStorageService: FileStorageService,
): Promise<void> {
  const log = req.requestLogger;
  const extractionService = res.locals.extractionService;
  const extractionQueries = res.locals.extractionQueries;

  const userId = requireAuthUserId(req, next);
  if (userId === null) {
    return;
  }

  try {
    const file = req.file;
    if (file === undefined) {
      throw new HttpResponseError(400, 'MISSING_FILE', 'Request must include multipart field "file"');
    }

    log?.info('Extraction started', {
      userId,
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      requestId: req.id,
    });

    const started = performance.now();
    const result = await extractionService.extractInvoice({
      imageBuffer: file.buffer,
      mimeType: file.mimetype,
      userId,
      requestId: req.id,
    });
    const routeDurationMs = performance.now() - started;

    if (result.success) {
      const { data: invoiceData, tokensUsed, durationMs, slow } = result.data;
      let extractionId: string;
      try {
        const row = await extractionQueries.insertExtraction({
          userId,
          requestId: req.id,
          invoiceNumber: invoiceData.invoice_number,
          custCode: invoiceData.cust_code,
          extractionData: invoiceData,
          tokensInput: tokensUsed.input,
          tokensOutput: tokensUsed.output,
          tokensTotal: tokensUsed.total,
          durationMs,
          slow,
          modelName: env.CLAUDE_MODEL,
          sourceMimeType: file.mimetype,
          sourceOriginalFilename: file.originalname,
          sourceFileSizeBytes: file.size,
        });
        extractionId = row.id;

        try {
          const storedPath = await fileStorageService.saveFile(
            extractionId,
            file.buffer,
            file.mimetype,
          );
          const updated = await extractionQueries.updateFilePathForUser(
            extractionId,
            userId,
            storedPath,
          );
          if (!updated) {
            throw new Error('Failed to update file_path after save');
          }
        } catch (fileError: unknown) {
          log?.error('Extraction file storage failed', {
            message: fileError instanceof Error ? fileError.message : String(fileError),
            extractionId,
            requestId: req.id,
          });
          next(
            new HttpResponseError(
              500,
              'FILE_STORAGE_ERROR',
              'Extraction saved but storing the source file failed.',
            ),
          );
          return;
        }
      } catch (persistError: unknown) {
        const mapped = mapExtractionPersistError(persistError);
        log?.error('Extraction persistence failed', {
          code: mapped.code,
          message: mapped.devDetail ?? mapped.message,
          requestId: req.id,
        });
        const clientMessage =
          env.NODE_ENV === 'development' && mapped.devDetail !== undefined
            ? `${mapped.message} (${mapped.devDetail})`
            : mapped.message;
        next(
          new HttpResponseError(mapped.statusCode, mapped.code, clientMessage),
        );
        return;
      }

      log?.info('Extraction HTTP success', {
        userId,
        invoiceNumber: invoiceData.invoice_number,
        extractionId,
        tokens: tokensUsed.total,
        durationMs,
        routeDurationMs,
        requestId: req.id,
      });
      res.status(200).json({
        success: true,
        data: { ...result.data, extractionId },
      });
      return;
    }

    const extractionError: ExtractionError = result.error;
    const meta = EXTRACTION_ERROR_METADATA[extractionError.type];
    const statusCode = extractionError.httpStatus ?? meta.httpStatus;

    log?.warn('Extraction HTTP failure', {
      userId,
      errorType: extractionError.type,
      message: extractionError.message,
      statusCode,
      requestId: req.id,
    });

    const errorPayload: {
      type: string;
      code: string;
      message: string;
      fieldErrors?: ReadonlyArray<FieldError>;
    } = {
      type: extractionError.type,
      code: extractionError.type,
      message: extractionError.message,
    };

    if (extractionError.fieldErrors !== undefined) {
      errorPayload.fieldErrors = extractionError.fieldErrors;
    }

    res.status(statusCode).json({
      success: false,
      error: errorPayload,
    });
  } catch (error: unknown) {
    next(error);
  }
}
