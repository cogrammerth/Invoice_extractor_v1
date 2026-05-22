/**
 * Email/password authentication and JWT issuance.
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import type { UserQueries } from '../db/user-queries.js';
import { rowToAuthUser } from '../db/user-queries.js';
import type {
  AuthProvidersPayload,
  AuthUser,
  LoginSuccessPayload,
  UserRole,
} from '../types/auth.types.js';
import {
  isEmailDomainAllowed,
  isValidEmailFormat,
  normalizeEmail,
} from '../utils/email.js';
import { HttpResponseError } from '../utils/http-response-error.js';

const BCRYPT_ROUNDS = 12;

export interface AuthServiceConfig {
  readonly jwtSecret: string;
  readonly jwtIssuer: string;
  readonly jwtAudience: string;
  readonly accessExpiresIn: string;
  readonly allowedEmailDomains: readonly string[];
  readonly microsoftEnabled: boolean;
  readonly googleEnabled: boolean;
}

export interface AuthService {
  getProviders(): AuthProvidersPayload;
  loginWithPassword(email: string, password: string): Promise<LoginSuccessPayload>;
  signAccessToken(user: AuthUser): string;
  hashPassword(plain: string): Promise<string>;
  verifyPassword(plain: string, hash: string): Promise<boolean>;
  assertEmailAllowed(email: string): void;
  resolveUserForSso(input: {
    email: string;
    provider: 'microsoft' | 'google';
    externalSubject: string;
    defaultRole?: UserRole;
  }): Promise<AuthUser>;
}

export function createAuthService(
  userQueries: UserQueries,
  config: AuthServiceConfig,
): AuthService {
  const signAccessToken = (user: AuthUser): string => {
    const signOptions: jwt.SignOptions = {
      algorithm: 'HS256',
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
      expiresIn: config.accessExpiresIn as jwt.SignOptions['expiresIn'],
    };
    return jwt.sign(
      {
        sub: user.id,
        role: user.role,
        email: user.email,
      },
      config.jwtSecret,
      signOptions,
    );
  };

  const assertEmailAllowed = (email: string): void => {
    if (!isValidEmailFormat(email)) {
      throw new HttpResponseError(400, 'VALIDATION_ERROR', 'Invalid email address');
    }
    if (!isEmailDomainAllowed(email, config.allowedEmailDomains)) {
      const domains =
        config.allowedEmailDomains.length > 0
          ? config.allowedEmailDomains.join(', ')
          : '';
      throw new HttpResponseError(
        403,
        'EMAIL_DOMAIN_NOT_ALLOWED',
        domains.length > 0
          ? `Only organizational email domains are allowed (${domains})`
          : 'Email domain is not allowed',
      );
    }
  };

  return {
    getProviders(): AuthProvidersPayload {
      return {
        emailPassword: true,
        microsoft: config.microsoftEnabled,
        google: config.googleEnabled,
        allowedEmailDomains: [...config.allowedEmailDomains],
      };
    },

    signAccessToken,

    async hashPassword(plain: string): Promise<string> {
      return bcrypt.hash(plain, BCRYPT_ROUNDS);
    },

    async verifyPassword(plain: string, hash: string): Promise<boolean> {
      return bcrypt.compare(plain, hash);
    },

    assertEmailAllowed,

    async loginWithPassword(
      email: string,
      password: string,
    ): Promise<LoginSuccessPayload> {
      assertEmailAllowed(email);

      if (password.length === 0) {
        throw new HttpResponseError(400, 'VALIDATION_ERROR', 'Password is required');
      }

      const row = await userQueries.findByEmail(email);
      if (row === null || row.password_hash === null) {
        throw new HttpResponseError(
          401,
          'INVALID_CREDENTIALS',
          'Invalid email or password',
        );
      }

      if (!row.is_active) {
        throw new HttpResponseError(403, 'ACCOUNT_DISABLED', 'Account is disabled');
      }

      const valid = await bcrypt.compare(password, row.password_hash);
      if (!valid) {
        throw new HttpResponseError(
          401,
          'INVALID_CREDENTIALS',
          'Invalid email or password',
        );
      }

      const user = rowToAuthUser(row);
      const accessToken = signAccessToken(user);

      return {
        accessToken,
        expiresIn: config.accessExpiresIn,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      };
    },

    async resolveUserForSso(input: {
      email: string;
      provider: 'microsoft' | 'google';
      externalSubject: string;
      defaultRole?: UserRole;
    }): Promise<AuthUser> {
      assertEmailAllowed(input.email);

      const normalized = normalizeEmail(input.email);
      const defaultRole = input.defaultRole ?? 'operator';

      const bySubject = await userQueries.findByProviderSubject(
        input.provider,
        input.externalSubject,
      );
      if (bySubject !== null) {
        if (!bySubject.is_active) {
          throw new HttpResponseError(403, 'ACCOUNT_DISABLED', 'Account is disabled');
        }
        return rowToAuthUser(bySubject);
      }

      const byEmail = await userQueries.findByEmail(normalized);
      if (byEmail !== null) {
        if (!byEmail.is_active) {
          throw new HttpResponseError(403, 'ACCOUNT_DISABLED', 'Account is disabled');
        }
        if (
          byEmail.external_subject === null ||
          byEmail.external_subject !== input.externalSubject
        ) {
          const linked = await userQueries.linkSsoToExistingUser(
            byEmail.id,
            input.provider,
            input.externalSubject,
          );
          return rowToAuthUser(linked);
        }
        return rowToAuthUser(byEmail);
      }

      const created = await userQueries.createSsoUser({
        email: normalized,
        role: defaultRole,
        authProvider: input.provider,
        externalSubject: input.externalSubject,
      });
      return rowToAuthUser(created);
    },
  };
}

