/**
 * Express application factory (HTTP server wiring without listen).
 */

import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import cors from 'cors';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import type { Pool } from 'pg';

import { type Env } from './config/env.js';
import { isRunningOnRailway } from './config/production-urls.js';
import { createPool } from './config/database.js';
import { createExtractionQueries, type ExtractionQueries } from './db/extraction-queries.js';
import type { ClaudeExtractionService } from './services/claude-extraction-service.js';
import { createFileStorageService, type FileStorageService } from './services/file-storage.service.js';
import { createJwtAuthMiddleware } from './middleware/auth.middleware.js';
import { createUploadRateLimiter } from './middleware/upload-rate-limit.middleware.js';
import { createAuthStack } from './config/auth-factory.js';
import { createLoginRateLimiter } from './middleware/login-rate-limit.middleware.js';
import { createAuthRouter } from './routes/auth.js';
import { createThaiInvoicesRouter } from './routes/thai-invoices.js';
import { errorHandlerMiddleware } from './middleware/error-handler.middleware.js';
import { childLogger } from './utils/logger.js';

const BYTES_PER_MEGABYTE = 1024 * 1024;

export interface CreateAppDeps {
  readonly env: Env;
  readonly extractionService: ClaudeExtractionService;
  readonly pool?: Pool;
  readonly extractionQueries?: ExtractionQueries;
  readonly fileStorageService?: FileStorageService;
}

export interface AppInstance {
  readonly app: Express;
  readonly pool: Pool;
  readonly ownsPool: boolean;
}

function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = randomUUID();
  req.id = requestId;
  req.requestLogger = childLogger({
    requestId,
    method: req.method,
    path: req.path,
  });

  const start = performance.now();
  res.on('finish', () => {
    const durationMs = performance.now() - start;
    req.requestLogger?.info('HTTP request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      requestId,
    });
  });

  next();
}

/**
 * Build the Express app and shared resources. Caller must `pool.end()` when done.
 */
export function createApp(deps: CreateAppDeps): AppInstance {
  const { env, extractionService } = deps;
  const ownsPool = deps.pool === undefined;
  const pool = deps.pool ?? createPool(env);
  const extractionQueries = deps.extractionQueries ?? createExtractionQueries(pool);
  const fileStorageService =
    deps.fileStorageService ?? createFileStorageService(env.UPLOAD_DIR);

  const maxJsonBodyBytes = env.MAX_FILE_SIZE_MB * BYTES_PER_MEGABYTE;

  const app = express();
  app.set('trust proxy', true);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (origin === undefined) {
          callback(null, true);
          return;
        }
        if (origin === env.ALLOWED_ORIGIN) {
          callback(null, origin);
          return;
        }
        if (isRunningOnRailway() && origin.endsWith('.up.railway.app')) {
          callback(null, origin);
          return;
        }
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
      exposedHeaders: ['Content-Type'],
    }),
  );
  app.use(express.json({ limit: maxJsonBodyBytes }));
  app.use(requestLoggingMiddleware);

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.locals.extractionService = extractionService;
    res.locals.extractionQueries = extractionQueries;
    next();
  });

  app.get('/health', (_req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      status: 'ok',
      claudeModel: env.CLAUDE_MODEL,
    });
  });

  const jwtAuthMiddleware = createJwtAuthMiddleware({
    secret: env.JWT_SECRET,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });

  const uploadRateLimiter = createUploadRateLimiter({
    windowMs: env.UPLOAD_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    limit: env.UPLOAD_RATE_LIMIT_MAX,
  });

  const { authService, oauthService } = createAuthStack(env, pool);
  const loginRateLimiter = createLoginRateLimiter();

  app.use(
    '/api/auth',
    createAuthRouter({
      authService,
      oauthService,
      publicApiBaseUrl: env.PUBLIC_API_BASE_URL,
      frontendAuthCallbackUrl: env.FRONTEND_AUTH_CALLBACK_URL,
      loginRateLimiter,
    }),
  );

  app.use(
    '/api/thai-invoices',
    createThaiInvoicesRouter({
      jwtAuthMiddleware,
      uploadRateLimiter,
      fileStorageService,
    }),
  );

  app.use((_req: Request, res: Response): void => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
  });

  app.use(errorHandlerMiddleware);

  return { app, pool, ownsPool };
}
