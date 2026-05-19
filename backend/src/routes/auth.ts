/**
 * Authentication routes: email/password login and organizational OAuth.
 */

import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from 'express';
import { z } from 'zod';

import type { AuthService } from '../services/auth.service.js';
import type { OAuthProvider, OAuthService } from '../services/oauth.service.js';
import { HttpResponseError } from '../utils/http-response-error.js';

const loginBodySchema = z.object({
  email: z.string().min(3).max(320),
  password: z.string().min(1).max(256),
});

export interface CreateAuthRouterDeps {
  readonly authService: AuthService;
  readonly oauthService: OAuthService;
  readonly publicApiBaseUrl: string;
  readonly frontendAuthCallbackUrl: string;
  readonly loginRateLimiter?: RequestHandler;
}

function backendOAuthCallbackUrl(
  publicApiBaseUrl: string,
  provider: OAuthProvider,
): string {
  const base = publicApiBaseUrl.replace(/\/$/, '');
  return `${base}/api/auth/oauth/${provider}/callback`;
}

export function createAuthRouter(deps: CreateAuthRouterDeps): Router {
  const router = Router();

  router.get('/providers', (_req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      data: deps.authService.getProviders(),
    });
  });

  const loginHandlers: RequestHandler[] = [];
  if (deps.loginRateLimiter !== undefined) {
    loginHandlers.push(deps.loginRateLimiter);
  }
  loginHandlers.push(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = loginBodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpResponseError(400, 'VALIDATION_ERROR', 'Invalid login request');
      }

      const result = await deps.authService.loginWithPassword(
        parsed.data.email,
        parsed.data.password,
      );

      res.status(200).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  });
  router.post('/login', ...loginHandlers);

  const startOAuth =
    (provider: OAuthProvider) =>
    (req: Request, res: Response, next: NextFunction): void => {
      try {
        const callbackUrl = backendOAuthCallbackUrl(deps.publicApiBaseUrl, provider);
        const url = deps.oauthService.getAuthorizationUrl(provider, callbackUrl);
        res.redirect(302, url);
      } catch (e) {
        next(e);
      }
    };

  router.get('/oauth/microsoft', startOAuth('microsoft'));
  router.get('/oauth/google', startOAuth('google'));

  const oauthCallback =
    (provider: OAuthProvider) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const code = typeof req.query.code === 'string' ? req.query.code : '';
        const state = typeof req.query.state === 'string' ? req.query.state : '';
        const oauthError = typeof req.query.error === 'string' ? req.query.error : '';

        if (oauthError.length > 0) {
          const failUrl = new URL(deps.frontendAuthCallbackUrl);
          failUrl.searchParams.set('error', oauthError);
          res.redirect(302, failUrl.toString());
          return;
        }

        if (code.length === 0 || state.length === 0) {
          throw new HttpResponseError(400, 'VALIDATION_ERROR', 'Missing OAuth code or state');
        }

        const callbackUrl = backendOAuthCallbackUrl(deps.publicApiBaseUrl, provider);
        const { redirectUrl } = await deps.oauthService.handleCallback(
          provider,
          code,
          state,
          callbackUrl,
          deps.authService,
        );
        res.redirect(302, redirectUrl);
      } catch (e) {
        next(e);
      }
    };

  router.get('/oauth/microsoft/callback', (req, res, next) => {
    void oauthCallback('microsoft')(req, res, next);
  });
  router.get('/oauth/google/callback', (req, res, next) => {
    void oauthCallback('google')(req, res, next);
  });

  return router;
}
