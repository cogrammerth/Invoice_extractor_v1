/**
 * Unit tests for JWT bearer middleware (no HTTP server).
 */

import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { createJwtAuthMiddleware } from './auth.middleware.js';
import { HttpResponseError } from '../utils/http-response-error.js';

const SECRET = 'unit-test-jwt-secret-32-characters!!';
const ISS = 'test-issuer';
const AUD = 'test-audience';

function createReq(authorization?: string): Request {
  return {
    get: (name: string): string | undefined => {
      if (name.toLowerCase() === 'authorization') {
        return authorization;
      }
      return undefined;
    },
  } as Request;
}

describe('createJwtAuthMiddleware', () => {
  it('rejects when Authorization header is missing', () => {
    const mw = createJwtAuthMiddleware({ secret: SECRET, issuer: ISS, audience: AUD });
    const next = vi.fn();
    mw(createReq(undefined), {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = vi.mocked(next).mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(HttpResponseError);
    expect((err as HttpResponseError).statusCode).toBe(401);
  });

  it('accepts a valid HS256 token and sets req.auth.userId from sub', () => {
    const token = jwt.sign({ sub: 'user-abc-42' }, SECRET, {
      algorithm: 'HS256',
      issuer: ISS,
      audience: AUD,
      expiresIn: '10m',
    });

    const mw = createJwtAuthMiddleware({ secret: SECRET, issuer: ISS, audience: AUD });
    const req = createReq(`Bearer ${token}`);
    const next = vi.fn();
    mw(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.auth?.userId).toBe('user-abc-42');
    expect(req.auth?.role).toBe('operator');
  });

  it('reads role claim from token', () => {
    const token = jwt.sign({ sub: 'u1', role: 'admin' }, SECRET, {
      algorithm: 'HS256',
      issuer: ISS,
      audience: AUD,
      expiresIn: '10m',
    });

    const mw = createJwtAuthMiddleware({ secret: SECRET, issuer: ISS, audience: AUD });
    const req = createReq(`Bearer ${token}`);
    const next = vi.fn();
    mw(req, {} as Response, next);

    expect(req.auth?.role).toBe('admin');
  });

  it('rejects an expired token', () => {
    const token = jwt.sign(
      {
        sub: 'user-x',
        iss: ISS,
        aud: AUD,
        exp: Math.floor(Date.now() / 1000) - 120,
      },
      SECRET,
      { algorithm: 'HS256' },
    );

    const mw = createJwtAuthMiddleware({ secret: SECRET, issuer: ISS, audience: AUD });
    const next = vi.fn();
    mw(createReq(`Bearer ${token}`), {} as Response, next);

    expect(vi.mocked(next).mock.calls[0]?.[0]).toBeInstanceOf(HttpResponseError);
    const err = vi.mocked(next).mock.calls[0]?.[0] as HttpResponseError;
    expect(err.message).toContain('expired');
  });

  it('rejects wrong audience', () => {
    const token = jwt.sign({ sub: 'user-x' }, SECRET, {
      algorithm: 'HS256',
      issuer: ISS,
      audience: 'wrong-aud',
      expiresIn: '10m',
    });

    const mw = createJwtAuthMiddleware({ secret: SECRET, issuer: ISS, audience: AUD });
    const next = vi.fn();
    mw(createReq(`Bearer ${token}`), {} as Response, next);

    expect(vi.mocked(next).mock.calls[0]?.[0]).toBeInstanceOf(HttpResponseError);
  });

  it('rejects token with empty sub', () => {
    const token = jwt.sign({ sub: '   ' }, SECRET, {
      algorithm: 'HS256',
      issuer: ISS,
      audience: AUD,
      expiresIn: '10m',
    });

    const mw = createJwtAuthMiddleware({ secret: SECRET, issuer: ISS, audience: AUD });
    const next = vi.fn();
    mw(createReq(`Bearer ${token}`), {} as Response, next);

    expect(vi.mocked(next).mock.calls[0]?.[0]).toBeInstanceOf(HttpResponseError);
  });
});
