/**
 * Wire auth + OAuth services from validated environment.
 */

import type { Pool } from 'pg';

import type { Env } from './env.js';
import { createUserQueries } from '../db/user-queries.js';
import { createAuthService, type AuthService } from '../services/auth.service.js';
import { createOAuthService, type OAuthService } from '../services/oauth.service.js';

export interface AuthStack {
  readonly authService: AuthService;
  readonly oauthService: OAuthService;
}

export function createAuthStack(env: Env, pool: Pool): AuthStack {
  const userQueries = createUserQueries(pool);

  const microsoftEnabled =
    env.MICROSOFT_CLIENT_ID !== undefined &&
    env.MICROSOFT_CLIENT_ID.length > 0 &&
    env.MICROSOFT_CLIENT_SECRET !== undefined &&
    env.MICROSOFT_CLIENT_SECRET.length > 0;

  const googleEnabled =
    env.GOOGLE_CLIENT_ID !== undefined &&
    env.GOOGLE_CLIENT_ID.length > 0 &&
    env.GOOGLE_CLIENT_SECRET !== undefined &&
    env.GOOGLE_CLIENT_SECRET.length > 0;

  const authService = createAuthService(userQueries, {
    jwtSecret: env.JWT_SECRET,
    jwtIssuer: env.JWT_ISSUER,
    jwtAudience: env.JWT_AUDIENCE,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    allowedEmailDomains: env.AUTH_ALLOWED_EMAIL_DOMAINS,
    microsoftEnabled,
    googleEnabled,
  });

  const oauthService = createOAuthService({
    jwtSecret: env.JWT_SECRET,
    frontendAuthCallbackUrl: env.FRONTEND_AUTH_CALLBACK_URL,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    ...(microsoftEnabled
      ? {
          microsoft: {
            clientId: env.MICROSOFT_CLIENT_ID as string,
            clientSecret: env.MICROSOFT_CLIENT_SECRET as string,
            tenantId: env.MICROSOFT_TENANT_ID,
          },
        }
      : {}),
    ...(googleEnabled
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID as string,
            clientSecret: env.GOOGLE_CLIENT_SECRET as string,
          },
        }
      : {}),
  });

  return { authService, oauthService };
}
