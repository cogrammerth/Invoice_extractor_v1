import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const backendRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: backendRoot,
  test: {
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/integration/setup-env.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
