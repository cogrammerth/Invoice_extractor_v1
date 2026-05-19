/**
 * Self-check: load backend/.env, ensure JWT_SECRET is valid, mint + verify HS256.
 * Does not start HTTP server or call Claude/DB.
 *
 *   npm run test:jwt
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(scriptDir, '..', '.env');

if (!existsSync(envPath)) {
  console.log(
    JSON.stringify({
      ok: false,
      step: 'env_file',
      message: 'backend/.env not found',
      path: envPath,
    }),
  );
  process.exit(1);
}

dotenv.config({ path: envPath, override: true });

const secret = (process.env.JWT_SECRET ?? '').trim();
const issuer = (process.env.JWT_ISSUER ?? 'thai-invoice-extractor').trim();
const audience = (process.env.JWT_AUDIENCE ?? 'thai-invoice-api').trim();

if (secret.length === 0) {
  console.log(
    JSON.stringify({
      ok: false,
      step: 'jwt_secret',
      message: 'JWT_SECRET is empty; add it to backend/.env (32+ characters)',
      path: envPath,
    }),
  );
  process.exit(1);
}

if (secret.length < 32) {
  console.log(
    JSON.stringify({
      ok: false,
      step: 'jwt_secret',
      message: `JWT_SECRET is only ${secret.length} chars; need at least 32`,
      path: envPath,
    }),
  );
  process.exit(1);
}

const sub = 'jwt-smoke-user';
const token = jwt.sign({ sub }, secret, {
  algorithm: 'HS256',
  issuer,
  audience,
  expiresIn: '60s',
});

try {
  const decoded = jwt.verify(token, secret, {
    algorithms: ['HS256'],
    issuer,
    audience,
  }) as jwt.JwtPayload;
  if (decoded.sub !== sub) {
    throw new Error('sub mismatch after verify');
  }
} catch (e) {
  console.log(
    JSON.stringify({
      ok: false,
      step: 'verify',
      message: e instanceof Error ? e.message : String(e),
    }),
  );
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    step: 'mint_and_verify',
    message:
      'JWT pipeline matches the server. Use: npm run jwt:dev -- <userId> then call /upload with Authorization: Bearer <token>',
    issuer,
    audience,
    sub,
  }),
);
