/**
 * Writes dist/runtime-config.json from API_URL (runtime) or VITE_API_URL before serve.
 * Railway invoice-ui: set API_URL to the public backend URL (no rebuild needed to change).
 */

import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(scriptDir, '..', 'dist');
const outPath = path.join(distDir, 'runtime-config.json');

const raw = process.env.API_URL ?? process.env.VITE_API_URL ?? '';
const apiUrl = raw.replace(/\/$/, '');

if (!existsSync(distDir)) {
  console.error('dist/ not found — run npm run build first');
  process.exit(1);
}

writeFileSync(outPath, `${JSON.stringify({ apiUrl }, null, 2)}\n`, 'utf-8');
console.log(
  apiUrl.length > 0
    ? `Wrote runtime-config.json → apiUrl=${apiUrl}`
    : 'Wrote runtime-config.json (empty apiUrl — uses Vite build default or localhost)',
);
