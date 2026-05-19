/**
 * Mint a short-lived HS256 JWT for local API testing.
 *
 * Usage (from backend/):
 *   npx tsx scripts/issue-dev-jwt.ts [sub]
 *
 * Example (Git Bash / macOS / Linux — real curl):
 *   npx tsx scripts/issue-dev-jwt.ts alice
 *   curl -H "Authorization: Bearer <token>" -F "file=@invoice.jpg" http://localhost:3000/api/thai-invoices/upload
 *
 * Windows PowerShell: `curl` is Invoke-WebRequest — use `curl.exe` or:
 *   $h = @{ Authorization = "Bearer <token>" }
 *   Invoke-RestMethod -Uri "http://localhost:3000/api/thai-invoices/extractions" -Headers $h
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(scriptDir, '..', '.env');

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}. Copy .env.example and set JWT_SECRET (32+ chars).`);
  process.exit(1);
}

dotenv.config({ path: envPath, override: true });

const secret =
  typeof process.env.JWT_SECRET === 'string'
    ? process.env.JWT_SECRET.trim()
    : '';
const issuer = (process.env.JWT_ISSUER ?? 'thai-invoice-extractor').trim();
const audience = (process.env.JWT_AUDIENCE ?? 'thai-invoice-api').trim();

if (secret.length === 0) {
  console.error(
    [
      'JWT_SECRET is missing or empty.',
      `Expected it in: ${envPath}`,
      'Add a line (no spaces around =):',
      '  JWT_SECRET=at-least-32-random-characters-here',
      'Tip: copy JWT_* lines from backend/.env.example, then replace the secret value.',
    ].join('\n'),
  );
  process.exit(1);
}

if (secret.length < 32) {
  console.error(
    [
      `JWT_SECRET is only ${secret.length} characters after trim; at least 32 are required (same rule as the server).`,
      `Read from: ${envPath}`,
      'If you used quotes, ensure the value inside them is still 32+ characters.',
      'Generate one example (64 hex chars): node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    ].join('\n'),
  );
  process.exit(1);
}

const sub = process.argv[2]?.trim() || 'dev-user-1';

const token = jwt.sign({ sub }, secret, {
  algorithm: 'HS256',
  issuer,
  audience,
  expiresIn: '24h',
});

console.log(
  JSON.stringify(
    {
      sub,
      issuer,
      audience,
      expiresIn: '24h',
      token,
    },
    null,
    2,
  ),
);
