/**
 * Rate limit for POST /api/auth/login (brute-force protection).
 */

import rateLimit from 'express-rate-limit';

export function createLoginRateLimiter(): ReturnType<typeof rateLimit> {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT',
        message: 'Too many login attempts. Try again later.',
      },
    },
  });
}
