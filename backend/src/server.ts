/**
 * HTTP server bootstrap — listens on PORT and handles graceful shutdown.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Anthropic from '@anthropic-ai/sdk';
import pg from 'pg';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { ensureExtractionsSchema } from './db/ensure-extractions-schema.js';
import { ClaudeExtractionService } from './services/claude-extraction-service.js';
import { logger } from './utils/logger.js';

const ANTHROPIC_TIMEOUT_MS = 30_000;
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 10_000;

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
  timeout: ANTHROPIC_TIMEOUT_MS,
});

const extractionService = new ClaudeExtractionService({
  anthropic,
  modelName: env.CLAUDE_MODEL,
  logger,
  timeoutMs: ANTHROPIC_TIMEOUT_MS,
});

const { app, pool } = createApp({ env, extractionService });
const httpServer = createServer(app);

/**
 * Run all SQL migrations from `dist/db/migrations/` (copied there by the
 * build's `copy:assets` step) using a dedicated pg.Client so the pool is
 * not consumed during startup.
 *
 * Enabled when `RUN_MIGRATIONS_ON_START=true` (or `1`).
 */
async function runMigrations(): Promise<void> {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationsDir = path.join(serverDir, 'db', 'migrations');

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    logger.warn('RUN_MIGRATIONS_ON_START is enabled but no migration files found', {
      migrationsDir,
    });
    return;
  }

  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  const applied: string[] = [];
  try {
    for (const file of files) {
      const sql = readFileSync(path.join(migrationsDir, file), 'utf-8');
      await client.query(sql);
      applied.push(file);
    }
  } finally {
    await client.end().catch(() => undefined);
  }

  logger.info('Migrations applied', { applied });
}

async function startServer(): Promise<void> {
  if (env.RUN_MIGRATIONS_ON_START) {
    logger.info('Running database migrations before startup…');
    try {
      await runMigrations();
    } catch (error: unknown) {
      logger.error('Migration failed — aborting startup', {
        message: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  }

  try {
    await ensureExtractionsSchema(pool);
  } catch (error: unknown) {
    logger.error('Database schema check failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }

  httpServer.listen(env.PORT, () => {
    logger.info('Server started', {
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
      claudeModel: env.CLAUDE_MODEL,
    });
  });
}

void startServer();

function scheduleForcedExit(): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    logger.error('Graceful shutdown timed out; exiting');
    process.exit(1);
  }, GRACEFUL_SHUTDOWN_TIMEOUT_MS);
}

async function endPoolSafely(): Promise<void> {
  try {
    await pool.end();
    logger.info('PostgreSQL pool closed');
  } catch (error: unknown) {
    logger.error('PostgreSQL pool close error', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

function shutdown(signal: NodeJS.Signals): void {
  logger.info('Graceful shutdown initiated', { signal });
  const forceExitTimer = scheduleForcedExit();

  httpServer.close((closeErr?: Error) => {
    void (async (): Promise<void> => {
      clearTimeout(forceExitTimer);
      await endPoolSafely();
      if (closeErr !== undefined) {
        logger.error('HTTP server close error', {
          message: closeErr.message,
          stack: closeErr.stack,
        });
        process.exit(1);
        return;
      }
      logger.info('HTTP server closed cleanly');
      process.exit(0);
    })();
  });
}

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    shutdown(sig);
  });
}
