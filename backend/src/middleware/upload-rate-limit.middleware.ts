/**
 * Per-user rate limit for invoice upload (runs after JWT auth).
 *
 * Keys by `req.auth.userId` so each JWT subject has its own quota. Falls back
 * to client IP (via `ipKeyGenerator`) only if `auth` is missing — should not
 * happen on `/upload` when ordered after `createJwtAuthMiddleware`.
 */

import type { Request, RequestHandler, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

export interface UploadRateLimiterOptions {
  readonly windowMs: number;
  readonly limit: number;
}

/**
 * Stable key for the in-memory rate limit store (exported for unit tests).
 */
export function uploadRateLimitKey(req: Request): string {
  const uid = req.auth?.userId;
  if (typeof uid === 'string' && uid.length > 0) {
    return `upload:user:${uid}`;
  }
  const ip = req.ip;
  return `upload:ip:${ipKeyGenerator(typeof ip === 'string' ? ip : '')}`;
}

/**
 * Factory for Express middleware limiting upload frequency per authenticated user.
 */
export function createUploadRateLimiter(
  options: UploadRateLimiterOptions,
): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: { trustProxy: false },
    keyGenerator: (req: Request) => uploadRateLimitKey(req),
    handler: (_req: Request, res: Response): void => {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message:
            'Too many invoice uploads in this period. Please try again later.',
        },
      });
    },
  });
}
