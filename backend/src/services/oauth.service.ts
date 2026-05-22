/**
 * OAuth2 authorization-code flows for Microsoft Entra ID and Google Workspace.
 */

import { createHash, randomBytes } from 'node:crypto';

import jwt from 'jsonwebtoken';

import type { AuthService } from './auth.service.js';
import { HttpResponseError } from '../utils/http-response-error.js';

export type OAuthProvider = 'microsoft' | 'google';

export interface OAuthServiceConfig {
  readonly jwtSecret: string;
  readonly frontendAuthCallbackUrl: string;
  readonly accessExpiresIn: string;
  readonly microsoft?: {
    readonly clientId: string;
    readonly clientSecret: string;
    readonly tenantId: string;
  };
  readonly google?: {
    readonly clientId: string;
    readonly clientSecret: string;
  };
}

interface OAuthStatePayload {
  readonly provider: OAuthProvider;
  readonly nonce: string;
}

export interface OAuthService {
  isMicrosoftEnabled(): boolean;
  isGoogleEnabled(): boolean;
  getAuthorizationUrl(provider: OAuthProvider, backendCallbackUrl: string): string;
  handleCallback(
    provider: OAuthProvider,
    code: string,
    state: string,
    backendCallbackUrl: string,
    authService: AuthService,
  ): Promise<{ redirectUrl: string }>;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64url');
}

function signState(payload: OAuthStatePayload, secret: string): string {
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '10m' });
}

function verifyState(token: string, secret: string): OAuthStatePayload {
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (typeof decoded === 'string') {
    throw new HttpResponseError(400, 'INVALID_OAUTH_STATE', 'Invalid OAuth state');
  }
  const p = decoded as jwt.JwtPayload;
  const provider = p['provider'];
  if (provider !== 'microsoft' && provider !== 'google') {
    throw new HttpResponseError(400, 'INVALID_OAUTH_STATE', 'Invalid OAuth state');
  }
  const nonce = p['nonce'];
  if (typeof nonce !== 'string' || nonce.length < 8) {
    throw new HttpResponseError(400, 'INVALID_OAUTH_STATE', 'Invalid OAuth state');
  }
  return { provider, nonce };
}

async function exchangeToken(
  tokenUrl: string,
  body: Record<string, string>,
): Promise<{ access_token: string }> {
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new HttpResponseError(
      502,
      'OAUTH_TOKEN_ERROR',
      `OAuth token exchange failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as { access_token?: string };
  if (typeof json.access_token !== 'string') {
    throw new HttpResponseError(502, 'OAUTH_TOKEN_ERROR', 'Missing access_token');
  }
  return { access_token: json.access_token };
}

async function fetchMicrosoftProfile(accessToken: string): Promise<{
  id: string;
  mail: string | null;
  userPrincipalName: string | null;
}> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new HttpResponseError(502, 'OAUTH_PROFILE_ERROR', 'Failed to load Microsoft profile');
  }
  const json = (await res.json()) as {
    id?: string;
    mail?: string | null;
    userPrincipalName?: string | null;
  };
  if (typeof json.id !== 'string') {
    throw new HttpResponseError(502, 'OAUTH_PROFILE_ERROR', 'Microsoft profile missing id');
  }
  return {
    id: json.id,
    mail: json.mail ?? null,
    userPrincipalName: json.userPrincipalName ?? null,
  };
}

async function fetchGoogleProfile(accessToken: string): Promise<{
  sub: string;
  email: string;
  email_verified?: boolean;
}> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new HttpResponseError(502, 'OAUTH_PROFILE_ERROR', 'Failed to load Google profile');
  }
  const json = (await res.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
  };
  if (typeof json.sub !== 'string' || typeof json.email !== 'string') {
    throw new HttpResponseError(502, 'OAUTH_PROFILE_ERROR', 'Google profile incomplete');
  }
  return { sub: json.sub, email: json.email, email_verified: json.email_verified };
}

export function createOAuthService(config: OAuthServiceConfig): OAuthService {
  const buildCallbackRedirect = (accessToken: string, expiresIn: string): string => {
    const url = new URL(config.frontendAuthCallbackUrl);
    url.searchParams.set('accessToken', accessToken);
    url.searchParams.set('expiresIn', expiresIn);
    return url.toString();
  };

  return {
    isMicrosoftEnabled(): boolean {
      return config.microsoft !== undefined;
    },

    isGoogleEnabled(): boolean {
      return config.google !== undefined;
    },

    getAuthorizationUrl(provider: OAuthProvider, backendCallbackUrl: string): string {
      const state = signState(
        { provider, nonce: base64UrlEncode(randomBytes(16)) },
        config.jwtSecret,
      );

      if (provider === 'microsoft') {
        const ms = config.microsoft;
        if (ms === undefined) {
          throw new HttpResponseError(
            503,
            'OAUTH_NOT_CONFIGURED',
            'Microsoft sign-in is not configured',
          );
        }
        const tenant = ms.tenantId.length > 0 ? ms.tenantId : 'common';
        const params = new URLSearchParams({
          client_id: ms.clientId,
          response_type: 'code',
          redirect_uri: backendCallbackUrl,
          response_mode: 'query',
          scope: 'openid profile email User.Read offline_access',
          state,
        });
        return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize?${params}`;
      }

      const google = config.google;
      if (google === undefined) {
        throw new HttpResponseError(
          503,
          'OAUTH_NOT_CONFIGURED',
          'Google sign-in is not configured',
        );
      }
      const params = new URLSearchParams({
        client_id: google.clientId,
        response_type: 'code',
        redirect_uri: backendCallbackUrl,
        scope: 'openid email profile',
        access_type: 'online',
        prompt: 'select_account',
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    },

    async handleCallback(
      provider: OAuthProvider,
      code: string,
      state: string,
      backendCallbackUrl: string,
      authService: AuthService,
    ): Promise<{ redirectUrl: string }> {
      const statePayload = verifyState(state, config.jwtSecret);
      if (statePayload.provider !== provider) {
        throw new HttpResponseError(400, 'INVALID_OAUTH_STATE', 'OAuth provider mismatch');
      }

      if (provider === 'microsoft') {
        const ms = config.microsoft;
        if (ms === undefined) {
          throw new HttpResponseError(503, 'OAUTH_NOT_CONFIGURED', 'Microsoft not configured');
        }
        const tenant = ms.tenantId.length > 0 ? ms.tenantId : 'common';
        const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
        const tokens = await exchangeToken(tokenUrl, {
          client_id: ms.clientId,
          client_secret: ms.clientSecret,
          code,
          redirect_uri: backendCallbackUrl,
          grant_type: 'authorization_code',
        });
        const profile = await fetchMicrosoftProfile(tokens.access_token);
        const email = profile.mail ?? profile.userPrincipalName;
        if (email === null || email.length === 0) {
          throw new HttpResponseError(
            502,
            'OAUTH_PROFILE_ERROR',
            'Microsoft account has no email on profile',
          );
        }
        const user = await authService.resolveUserForSso({
          email,
          provider: 'microsoft',
          externalSubject: profile.id,
        });
        const accessToken = authService.signAccessToken(user);
        return {
          redirectUrl: buildCallbackRedirect(accessToken, config.accessExpiresIn),
        };
      }

      const google = config.google;
      if (google === undefined) {
        throw new HttpResponseError(503, 'OAUTH_NOT_CONFIGURED', 'Google not configured');
      }
      const tokens = await exchangeToken('https://oauth2.googleapis.com/token', {
        client_id: google.clientId,
        client_secret: google.clientSecret,
        code,
        redirect_uri: backendCallbackUrl,
        grant_type: 'authorization_code',
      });
      const profile = await fetchGoogleProfile(tokens.access_token);
      if (profile.email_verified === false) {
        throw new HttpResponseError(
          403,
          'EMAIL_NOT_VERIFIED',
          'Google account email is not verified',
        );
      }
      const user = await authService.resolveUserForSso({
        email: profile.email,
        provider: 'google',
        externalSubject: profile.sub,
      });
      const accessToken = authService.signAccessToken(user);
      return {
        redirectUrl: buildCallbackRedirect(accessToken, config.accessExpiresIn),
      };
    },
  };
}

/** PKCE not required for confidential server-side clients; kept for future SPA flows. */
export function oauthCallbackFingerprint(provider: OAuthProvider, redirectUri: string): string {
  return createHash('sha256').update(`${provider}:${redirectUri}`).digest('hex').slice(0, 16);
}
