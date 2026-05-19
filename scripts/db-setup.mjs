/**
 * Database setup: start Postgres (Docker if available) → wait → migrate.
 *
 * Usage (repo root):  npm run db:setup
 *
 * Without Docker: ensure PostgreSQL is running locally and DATABASE_URL in
 * backend/.env is correct, then this script only waits + migrates.
 */

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const composeFile = path.join(repoRoot, 'docker', 'docker-compose.db.yml');

function isDockerAvailable() {
  const result = spawnSync('docker', ['--version'], {
    encoding: 'utf-8',
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  return result.status === 0;
}

function runNpm(script, { cwd = repoRoot, prefix } = {}) {
  const args = prefix ? ['run', script, '--prefix', prefix] : ['run', script];
  return new Promise((resolve, reject) => {
    const child = spawn('npm', args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`npm ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

function runDockerComposeUp() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'docker',
      ['compose', '-f', composeFile, 'up', '-d'],
      {
        cwd: repoRoot,
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: process.env,
      },
    );
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`docker compose exited with code ${code}`));
      }
    });
  });
}

async function main() {
  console.log('=== Database setup ===\n');

  if (isDockerAvailable()) {
    console.log('Docker found — starting PostgreSQL container...\n');
    try {
      await runDockerComposeUp();
    } catch (e) {
      console.error(
        '\nFailed to start Docker Postgres. Check Docker Desktop is running.\n',
      );
      process.exit(1);
    }
  } else {
    console.log(
      [
        'Docker is not installed or not on your PATH.',
        'Skipping container start — using PostgreSQL from backend/.env (DATABASE_URL).',
        '',
        'Options:',
        '  • Install Docker Desktop: https://docs.docker.com/desktop/setup/install/windows-install/',
        '    Then run:  npm run db:setup',
        '  • Or install PostgreSQL 17 locally and set DATABASE_URL in backend/.env',
        '    Example:  postgresql://invoice:invoice@localhost:5432/invoice_extractor',
        '    Create DB/user to match, or use your own connection string.',
        '',
      ].join('\n'),
    );
  }

  console.log('Waiting for PostgreSQL...\n');
  await runNpm('db:wait', { prefix: 'backend' });

  console.log('\nApplying migrations...\n');
  await runNpm('db:migrate', { prefix: 'backend' });

  console.log('\n=== Database setup complete ===\n');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
