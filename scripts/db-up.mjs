/**
 * Start PostgreSQL via Docker Compose (requires Docker on PATH).
 *
 * Usage: npm run db:up
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

if (!isDockerAvailable()) {
  console.error(
    [
      "Error: 'docker' is not recognized.",
      '',
      'Install Docker Desktop for Windows:',
      '  https://docs.docker.com/desktop/setup/install/windows-install/',
      '',
      'After install, restart the terminal and run:  npm run db:up',
      '',
      'Without Docker, use a local PostgreSQL server and run:',
      '  npm run db:setup:local',
    ].join('\n'),
  );
  process.exit(1);
}

const child = spawn('docker', ['compose', '-f', composeFile, 'up', '-d'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('close', (code) => {
  process.exit(code ?? 1);
});
