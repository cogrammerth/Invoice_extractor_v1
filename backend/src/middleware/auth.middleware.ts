/**
 * JWT bearer authentication for protected API routes.
 *
 * Expects `Authorization: Bearer <token>` with HS256 JWT whose `sub` claim
 * is the application user id (non-empty string). Optional `iss` / `aud`
 * are enforced when configured via env.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';

import type { UserRole } from '../types/auth.types.js';
import { USER_ROLES } from '../types/auth.types.js';
import { HttpResponseError } from '../utils/http-response-error.js';

export interface JwtAuthMiddlewareOptions {
  readonly secret: string;
  /** When set and non-empty, JWT `iss` must match. */
  readonly issuer?: string;
  /** When set and non-empty, JWT `aud` must match (string or string[] in token). */
  readonly audience?: string;
}

/**
 * Express middleware factory: verifies JWT and sets `req.auth.userId` from `sub`.
 */
export function createJwtAuthMiddleware(
  options: JwtAuthMiddlewareOptions,
): RequestHandler {
  const verifyOptions: jwt.VerifyOptions = {
    algorithms: ['HS256'],
    complete: false,
  };
  if (options.issuer !== undefined && options.issuer.length > 0) {
    verifyOptions.issuer = options.issuer;
  }
  if (options.audience !== undefined && options.audience.length > 0) {
    verifyOptions.audience = options.audience;
  }

  return (req: Request, _res: Response, next: NextFunction): void => {
    const raw = req.get('Authorization');
    if (raw === undefined || raw.length === 0) {
      next(
        new HttpResponseError(
          401,
          'UNAUTHORIZED',
          'Authorization header with Bearer token is required',
        ),
      );
      return;
    }

    const parts = raw.split(/\s+/);
    if (parts.length < 2 || parts[0]?.toLowerCase() !== 'bearer') {
      next(
        new HttpResponseError(
          401,
          'UNAUTHORIZED',
          'Authorization header must be Bearer token',
        ),
      );
      return;
    }

    const token = parts.slice(1).join(' ').trim();
    if (token.length === 0) {
      next(
        new HttpResponseError(401, 'UNAUTHORIZED', 'Bearer token is empty'),
      );
      return;
    }

    try {
      const decoded = jwt.verify(token, options.secret, verifyOptions);
      if (typeof decoded === 'string') {
        next(
          new HttpResponseError(401, 'UNAUTHORIZED', 'Invalid token payload'),
        );
        return;
      }

      const payload = decoded as jwt.JwtPayload;
      const userId = payload.sub;
      if (typeof userId !== 'string' || userId.trim().length === 0) {
        next(
          new HttpResponseError(
            401,
            'UNAUTHORIZED',
            'Token must include a non-empty subject (sub)',
          ),
        );
        return;
      }

      const rawRole = payload['role'];
      const role: UserRole =
        typeof rawRole === 'string' &&
        (USER_ROLES as readonly string[]).includes(rawRole)
          ? (rawRole as UserRole)
          : 'operator';

      const emailClaim = payload['email'];
      const email =
        typeof emailClaim === 'string' && emailClaim.trim().length > 0
          ? emailClaim.trim().toLowerCase()
          : undefined;

      req.auth = {
        userId: userId.trim(),
        role,
        ...(email !== undefined ? { email } : {}),
      };
      next();
    } catch (error: unknown) {
      if (error instanceof jwt.TokenExpiredError) {
        next(
          new HttpResponseError(
            401,
            'UNAUTHORIZED',
            'Access token expired. Sign in again.',
          ),
        );
        return;
      }
      if (error instanceof jwt.NotBeforeError) {
        next(
          new HttpResponseError(
            401,
            'UNAUTHORIZED',
            'Access token is not valid yet (nbf). Check system clock or mint a new token.',
          ),
        );
        return;
      }
      if (error instanceof jwt.JsonWebTokenError) {
        next(
          new HttpResponseError(
            401,
            'UNAUTHORIZED',
            'Invalid access token. Check the Bearer value, issuer/audience, and that JWT_SECRET matches the running server.',
          ),
        );
        return;
      }
      next(
        new HttpResponseError(
          401,
          'UNAUTHORIZED',
          'Invalid or expired access token',
        ),
      );
    }
  };
}
