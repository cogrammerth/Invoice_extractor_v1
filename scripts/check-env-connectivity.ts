/**
 * Shim: run the real check from `backend/` so this works when your shell cwd is the repo root.
 *
 *   npx tsx scripts/check-env-connectivity.ts
 *
 * Or from backend:
 *
 *   npm run check:env
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const backendDir = path.join(repoRoot, 'backend');
const innerScript = path.join(backendDir, 'scripts', 'check-env-connectivity.ts');

if (!existsSync(innerScript)) {
  console.error(
    `Expected backend check script at:\n  ${innerScript}\n` +
      'Make sure you are in the Invoice_extractor_v1 repo.',
  );
  process.exit(1);
}

const result = spawnSync('npx', ['tsx', 'scripts/check-env-connectivity.ts'], {
  cwd: backendDir,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status === null ? 1 : result.status);
