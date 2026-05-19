/**
 * Unit tests for upload rate limit key generation.
 */

import { describe, it, expect } from 'vitest';
import type { Request } from 'express';

import { uploadRateLimitKey } from './upload-rate-limit.middleware.js';

describe('uploadRateLimitKey', () => {
  it('prefers req.auth.userId when present', () => {
    const req = {
      auth: { userId: 'alice' },
      ip: '203.0.113.1',
    } as Request;
    expect(uploadRateLimitKey(req)).toBe('upload:user:alice');
  });

  it('falls back to ip-based key when auth is absent', () => {
    const req = { ip: '203.0.113.2' } as Request;
    expect(uploadRateLimitKey(req)).toMatch(/^upload:ip:/);
  });
});
