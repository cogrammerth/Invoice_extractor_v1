import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { UserQueries, UserDbRow } from '../db/user-queries.js';
import { createAuthService } from './auth.service.js';
import { HttpResponseError } from '../utils/http-response-error.js';

const CONFIG = {
  jwtSecret: 'test-jwt-secret-32-characters-min!!',
  jwtIssuer: 'test-issuer',
  jwtAudience: 'test-audience',
  accessExpiresIn: '1h',
  allowedEmailDomains: [] as string[],
  microsoftEnabled: false,
  googleEnabled: false,
};

function mockUser(row: Partial<UserDbRow> & Pick<UserDbRow, 'id' | 'email'>): UserDbRow {
  return {
    id: row.id,
    email: row.email,
    password_hash: row.password_hash ?? '$2b$12$placeholder',
    role: row.role ?? 'operator',
    auth_provider: row.auth_provider ?? 'local',
    external_subject: row.external_subject ?? null,
    is_active: row.is_active ?? true,
  };
}

describe('createAuthService', () => {
  let userQueries: UserQueries;

  beforeEach(() => {
    userQueries = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      findByProviderSubject: vi.fn(),
      createLocalUser: vi.fn(),
      createSsoUser: vi.fn(),
      linkSsoToExistingUser: vi.fn(),
    };
  });

  it('rejects login when user not found', async () => {
    vi.mocked(userQueries.findByEmail).mockResolvedValue(null);
    const auth = createAuthService(userQueries, CONFIG);
    await expect(
      auth.loginWithPassword('a@b.com', 'secret123'),
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('rejects login when account disabled', async () => {
    const auth = createAuthService(userQueries, CONFIG);
    const hash = await auth.hashPassword('secret123');
    vi.mocked(userQueries.findByEmail).mockResolvedValue(
      mockUser({
        id: 'u1',
        email: 'a@b.com',
        is_active: false,
        password_hash: hash,
      }),
    );
    await expect(
      auth.loginWithPassword('a@b.com', 'secret123'),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ACCOUNT_DISABLED' });
  });

  it('returns token on valid password', async () => {
    const auth = createAuthService(userQueries, CONFIG);
    const hash = await auth.hashPassword('secret123');
    vi.mocked(userQueries.findByEmail).mockResolvedValue(
      mockUser({ id: '550e8400-e29b-41d4-a716-446655440000', email: 'a@b.com', password_hash: hash }),
    );

    const result = await auth.loginWithPassword('a@b.com', 'secret123');
    expect(result.accessToken.length).toBeGreaterThan(20);
    expect(result.user.email).toBe('a@b.com');
    expect(result.user.role).toBe('operator');
  });

  it('enforces email domain allowlist', () => {
    const auth = createAuthService(userQueries, {
      ...CONFIG,
      allowedEmailDomains: ['company.com'],
    });
    expect(() => auth.assertEmailAllowed('user@gmail.com')).toThrow(HttpResponseError);
    expect(() => auth.assertEmailAllowed('user@company.com')).not.toThrow();
  });
});
