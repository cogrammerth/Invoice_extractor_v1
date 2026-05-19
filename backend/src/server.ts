/**
 * HTTP server bootstrap — listens on PORT and handles graceful shutdown.
 */

import { createServer } from 'node:http';

import Anthropic from '@anthropic-ai/sdk';

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

async function startServer(): Promise<void> {
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
