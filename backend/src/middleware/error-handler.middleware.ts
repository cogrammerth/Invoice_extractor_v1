/**
 * Global Express error handler
 *
 * Path: backend/src/middleware/error-handler.middleware.ts
 *
 * Last middleware in the chain. Maps thrown errors and Multer failures to
 * JSON responses without leaking stack traces in production.
 */

import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import type { Logger } from 'winston';

import { env } from '../config/env.js';
import { HttpResponseError } from '../utils/http-response-error.js';
import { logger } from '../utils/logger.js';
import type { ClaudeExtractionService } from '../services/claude-extraction-service.js';
import type { ExtractionQueries } from '../db/extraction-queries.js';
import type { UserRole } from '../types/auth.types.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Correlates logs for a single HTTP request. */
    id?: string;
    /** Child logger bound with request context (set by request-logging middleware). */
    requestLogger?: Logger;
    /** Set by JWT middleware on protected routes (`sub`, `role`, optional `email`). */
    auth?: {
      readonly userId: string;
      readonly role: UserRole;
      readonly email?: string;
    };
  }

  interface Locals {
    extractionService: ClaudeExtractionService;
    extractionQueries: ExtractionQueries;
  }
}

export { HttpResponseError };

const INTERNAL_ERROR_MESSAGE = 'An unexpected error occurred';

interface NormalizedError {
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
  readonly stack?: string;
}

/**
 * Map unknown failures to a consistent `{ statusCode, code, message, stack? }` shape.
 */
function normalizeError(error: unknown): NormalizedError {
  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return {
        statusCode: 413,
        code: 'FILE_TOO_LARGE',
        message: 'Uploaded file exceeds the configured size limit',
        stack: error.stack,
      };
    }
    return {
      statusCode: 400,
      code: error.code,
      message: error.message,
      stack: error.stack,
    };
  }

  if (error instanceof HttpResponseError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      stack: error.stack,
    };
  }

  if (error instanceof Error) {
    const extended = error as Error & {
      readonly statusCode?: number;
      readonly code?: string;
    };
    const statusCode =
      typeof extended.statusCode === 'number' && Number.isFinite(extended.statusCode)
        ? extended.statusCode
        : 500;
    const code =
      typeof extended.code === 'string' && extended.code.length > 0
        ? extended.code
        : 'INTERNAL_ERROR';
    return {
      statusCode,
      code,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: INTERNAL_ERROR_MESSAGE,
  };
}

interface ErrorResponseBody {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly stack?: string;
  };
}

/**
 * Express 4-arg error-handling middleware. Must be registered after all routes.
 *
 * @param error - Thrown value or `next(err)` payload
 * @param req - Current request
 * @param res - Response writer
 * @param _next - Unused; required for Express arity detection
 *
 * @example
 *   app.use(errorHandlerMiddleware);
 */
export function errorHandlerMiddleware(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const details = normalizeError(error);
  const requestLogger: Logger = req.requestLogger ?? logger;

  requestLogger.error('Request failed', {
    code: details.code,
    message: details.message,
    statusCode: details.statusCode,
    stack: details.stack,
    path: req.path,
    method: req.method,
    requestId: req.id,
  });

  if (res.headersSent) {
    return;
  }

  const payload: ErrorResponseBody = {
    success: false,
    error: {
      code: details.code,
      message: details.message,
    },
  };

  const includeStackInBody =
    env.NODE_ENV === 'development' &&
    details.stack !== undefined &&
    details.statusCode >= 500;

  if (includeStackInBody) {
    res.status(details.statusCode).json({
      ...payload,
      error: { ...payload.error, stack: details.stack },
    });
    return;
  }

  res.status(details.statusCode).json(payload);
}
