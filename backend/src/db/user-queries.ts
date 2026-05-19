/**
 * Parameterized queries for application users.
 */

import type { Pool } from 'pg';

import type { AuthProvider, UserRole } from '../types/auth.types.js';
import { normalizeEmail } from '../utils/email.js';

export interface UserDbRow {
  readonly id: string;
  readonly email: string;
  readonly password_hash: string | null;
  readonly role: string;
  readonly auth_provider: string;
  readonly external_subject: string | null;
  readonly is_active: boolean;
}

export interface CreateLocalUserParams {
  readonly email: string;
  readonly passwordHash: string;
  readonly role: UserRole;
}

export interface CreateSsoUserParams {
  readonly email: string;
  readonly role: UserRole;
  readonly authProvider: Exclude<AuthProvider, 'local'>;
  readonly externalSubject: string;
}

const SELECT_BY_EMAIL = `
SELECT id, email, password_hash, role, auth_provider, external_subject, is_active
FROM users
WHERE email = $1
LIMIT 1
`;

const SELECT_BY_ID = `
SELECT id, email, password_hash, role, auth_provider, external_subject, is_active
FROM users
WHERE id = $1::uuid
LIMIT 1
`;

const SELECT_BY_PROVIDER_SUBJECT = `
SELECT id, email, password_hash, role, auth_provider, external_subject, is_active
FROM users
WHERE auth_provider = $1 AND external_subject = $2
LIMIT 1
`;

const INSERT_LOCAL = `
INSERT INTO users (email, password_hash, role, auth_provider)
VALUES ($1, $2, $3, 'local')
RETURNING id, email, password_hash, role, auth_provider, external_subject, is_active
`;

const INSERT_SSO = `
INSERT INTO users (email, password_hash, role, auth_provider, external_subject)
VALUES ($1, NULL, $2, $3, $4)
RETURNING id, email, password_hash, role, auth_provider, external_subject, is_active
`;

const LINK_SSO = `
UPDATE users
SET auth_provider = $2,
    external_subject = $3,
    updated_at = NOW()
WHERE id = $1::uuid
RETURNING id, email, password_hash, role, auth_provider, external_subject, is_active
`;

export interface UserQueries {
  findByEmail(email: string): Promise<UserDbRow | null>;
  findById(id: string): Promise<UserDbRow | null>;
  findByProviderSubject(
    provider: AuthProvider,
    externalSubject: string,
  ): Promise<UserDbRow | null>;
  createLocalUser(params: CreateLocalUserParams): Promise<UserDbRow>;
  createSsoUser(params: CreateSsoUserParams): Promise<UserDbRow>;
  linkSsoToExistingUser(
    userId: string,
    provider: Exclude<AuthProvider, 'local'>,
    externalSubject: string,
  ): Promise<UserDbRow>;
}

export function createUserQueries(pool: Pool): UserQueries {
  return {
    async findByEmail(email: string): Promise<UserDbRow | null> {
      const result = await pool.query<UserDbRow>(SELECT_BY_EMAIL, [
        normalizeEmail(email),
      ]);
      return result.rows[0] ?? null;
    },

    async findById(id: string): Promise<UserDbRow | null> {
      const result = await pool.query<UserDbRow>(SELECT_BY_ID, [id]);
      return result.rows[0] ?? null;
    },

    async findByProviderSubject(
      provider: AuthProvider,
      externalSubject: string,
    ): Promise<UserDbRow | null> {
      const result = await pool.query<UserDbRow>(SELECT_BY_PROVIDER_SUBJECT, [
        provider,
        externalSubject,
      ]);
      return result.rows[0] ?? null;
    },

    async createLocalUser(params: CreateLocalUserParams): Promise<UserDbRow> {
      const result = await pool.query<UserDbRow>(INSERT_LOCAL, [
        normalizeEmail(params.email),
        params.passwordHash,
        params.role,
      ]);
      const row = result.rows[0];
      if (row === undefined) {
        throw new Error('Failed to create local user');
      }
      return row;
    },

    async createSsoUser(params: CreateSsoUserParams): Promise<UserDbRow> {
      const result = await pool.query<UserDbRow>(INSERT_SSO, [
        normalizeEmail(params.email),
        params.role,
        params.authProvider,
        params.externalSubject,
      ]);
      const row = result.rows[0];
      if (row === undefined) {
        throw new Error('Failed to create SSO user');
      }
      return row;
    },

    async linkSsoToExistingUser(
      userId: string,
      provider: Exclude<AuthProvider, 'local'>,
      externalSubject: string,
    ): Promise<UserDbRow> {
      const result = await pool.query<UserDbRow>(LINK_SSO, [
        userId,
        provider,
        externalSubject,
      ]);
      const row = result.rows[0];
      if (row === undefined) {
        throw new Error('Failed to link SSO user');
      }
      return row;
    },
  };
}

export function rowToAuthUser(row: UserDbRow): {
  id: string;
  email: string;
  role: UserRole;
  authProvider: AuthProvider;
  isActive: boolean;
} {
  const role = row.role as UserRole;
  const authProvider = row.auth_provider as AuthProvider;
  return {
    id: row.id,
    email: row.email,
    role,
    authProvider,
    isActive: row.is_active,
  };
}
