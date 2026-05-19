/**
 * Verify DATABASE_URL and ANTHROPIC_API_KEY using `backend/.env`.
 *
 * Recommended:
 *   cd backend && npm run check:env
 *
 * Exit uses a short deferral so Windows/libuv can finish closing TCP handles
 * from `pg` and the Anthropic client before `process.exit`.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

import dotenv from 'dotenv';
import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';

const DB_TIMEOUT_MS = 20_000;
/** Let sockets finish teardown before exit (Windows libuv race workaround). */
const EXIT_DEFER_MS = 200;

/** Matches `env.ts` — override via `CLAUDE_MODEL` in `.env`. */
const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendEnvPath = path.resolve(scriptDir, '..', '.env');

function loadBackendEnv(): void {
  if (!existsSync(backendEnvPath)) {
    throw new Error(
      `Missing env file:\n  ${backendEnvPath}\n` +
        'Copy backend/.env.example to backend/.env and fill in values.',
    );
  }
  const result = dotenv.config({ path: backendEnvPath, override: true });
  if (result.error) {
    throw new Error(
      `Could not load ${backendEnvPath}: ${result.error.message}`,
    );
  }
}

function isQuotaLimitedError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('429') || msg.includes('rate_limit');
}

function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function scheduleProcessExit(code: number): void {
  setTimeout(() => {
    process.exit(code);
  }, EXIT_DEFER_MS);
}

async function main(): Promise<number> {
  try {
    loadBackendEnv();
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }

  const dbUrl = process.env.DATABASE_URL;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const modelName =
    process.env.CLAUDE_MODEL?.trim() || DEFAULT_CLAUDE_MODEL;

  if (!dbUrl || !apiKey) {
    console.error(
      'Missing DATABASE_URL or ANTHROPIC_API_KEY after loading backend/.env',
    );
    return 1;
  }

  let dbOk = false;
  const client = new pg.Client({
    connectionString: dbUrl,
    connectionTimeoutMillis: DB_TIMEOUT_MS,
  });
  try {
    await client.connect();
    const r = await client.query('SELECT 1 AS ok');
    dbOk = r.rows[0]?.ok === 1;
  } catch (e) {
    console.error(
      'PostgreSQL:',
      e instanceof Error ? e.message : String(e),
    );
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }

  let claudeOk = false;
  let claudeDetail: string | undefined;
  let claudeNote: string | undefined;

  try {
    const anthropic = new Anthropic({ apiKey, timeout: 25_000 });
    const msg = await anthropic.messages.create({
      model: modelName,
      max_tokens: 8,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Reply with exactly: pong' }],
        },
      ],
    });
    const text = msg.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    claudeOk = text.length > 0;
    claudeDetail = claudeOk ? modelName : 'empty response';
  } catch (e) {
    if (isQuotaLimitedError(e)) {
      claudeOk = true;
      claudeDetail = modelName;
      claudeNote =
        'Anthropic returned quota/rate limit (429) — API key and model are reachable.';
    } else {
      claudeDetail = e instanceof Error ? e.message : String(e);
    }
  }

  await yieldEventLoop();
  await yieldEventLoop();

  console.log(
    JSON.stringify({
      envFile: backendEnvPath,
      database: dbOk ? 'ok' : 'failed',
      claude: claudeOk ? 'ok' : 'failed',
      model: modelName,
      claudeNote,
      claudeError: claudeOk ? undefined : claudeDetail,
    }),
  );

  return dbOk && claudeOk ? 0 : 1;
}

main()
  .then((code) => {
    scheduleProcessExit(code);
  })
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    scheduleProcessExit(1);
  });
