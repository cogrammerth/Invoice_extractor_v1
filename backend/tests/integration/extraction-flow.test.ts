/**
 * HTTP integration tests — real PostgreSQL, mocked Claude extraction.
 *
 * Prerequisites:
 *   1. PostgreSQL running
 *   2. DATABASE_URL in backend/.env (or INTEGRATION_DATABASE_URL)
 *   3. npm run db:migrate  (applies 001 + 002 including file_path)
 *
 * Run from backend/:  npm run test:integration
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';

import {
  createMockExtractionService,
  createTempUploadDir,
  ensureSchemaReady,
  integrationEnabled,
  INTEGRATION_DB_URL,
  MINIMAL_JPEG,
  mintTestToken,
  MOCK_EXTRACTION,
  removeDir,
  safeEndPool,
  truncateExtractions,
  waitForPostgres,
} from './helpers.js';

const INTEGRATION_SETUP_HELP = [
  'Integration tests require PostgreSQL on localhost:5432.',
  '',
  'Docker (recommended, from repo root):',
  '  npm run db:up',
  '  cd backend && npm run db:migrate',
  '  npm run test:integration',
  '',
  'Or one command: npm run test:integration:local',
  '',
  'backend/.env DATABASE_URL must match Docker:',
  '  postgresql://invoice:invoice@localhost:5432/invoice_extractor',
].join('\n');

if (!integrationEnabled) {
  describe('extraction API integration', () => {
    it('requires DATABASE_URL (PostgreSQL)', () => {
      throw new Error(
        `${INTEGRATION_SETUP_HELP}\n\nCurrent DATABASE_URL: ${
          INTEGRATION_DB_URL ?? '(not set)'
        }`,
      );
    });
  });
} else {
  describe('extraction API integration', () => {
    let pool: Pool | undefined;
    let uploadDir: string | undefined;
    let app: import('express').Express | undefined;

    const getApp = (): import('express').Express => {
      if (app === undefined) {
        throw new Error('Test app not initialized — beforeAll did not complete');
      }
      return app;
    };

    const userA = 'integration-user-a';
    const userB = 'integration-user-b';
    const tokenA = () => mintTestToken(userA);
    const tokenB = () => mintTestToken(userB);

    beforeAll(async () => {
      try {
        const { loadEnv } = await import('../../src/config/env.js');
        const { createApp } = await import('../../src/app.js');

        const env = loadEnv();
        uploadDir = await createTempUploadDir();
        pool = await waitForPostgres(env.DATABASE_URL);
        await ensureSchemaReady(pool);

        const extractionService = createMockExtractionService();
        const instance = createApp({
          env: { ...env, UPLOAD_DIR: uploadDir },
          extractionService,
          pool,
        });
        app = instance.app;
      } catch (e: unknown) {
        await safeEndPool(pool);
        pool = undefined;
        if (uploadDir !== undefined) {
          await removeDir(uploadDir);
          uploadDir = undefined;
        }
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(
          `${message}\n\n---\n${INTEGRATION_SETUP_HELP}`,
          { cause: e },
        );
      }
    }, 60_000);

    afterEach(async () => {
      if (pool !== undefined) {
        await truncateExtractions(pool);
      }
    });

    afterAll(async () => {
      await safeEndPool(pool);
      pool = undefined;
      if (uploadDir !== undefined) {
        await removeDir(uploadDir);
        uploadDir = undefined;
      }
    });

    it('GET /health returns ok', async () => {
      const res = await request(getApp()).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/thai-invoices/health returns ok', async () => {
      const res = await request(getApp()).get('/api/thai-invoices/health');
      expect(res.status).toBe(200);
      expect(res.body.scope).toBe('thai-invoices');
    });

    it('rejects upload without Authorization', async () => {
      const res = await request(getApp())
        .post('/api/thai-invoices/upload')
        .attach('file', MINIMAL_JPEG, {
          filename: 't.jpg',
          contentType: 'image/jpeg',
        });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects upload with invalid token', async () => {
      const res = await request(getApp())
        .post('/api/thai-invoices/upload')
        .set('Authorization', 'Bearer not-a-valid-jwt')
        .attach('file', MINIMAL_JPEG, {
          filename: 't.jpg',
          contentType: 'image/jpeg',
        });
      expect(res.status).toBe(401);
    });

    it('rejects upload with expired token', async () => {
      const res = await request(getApp())
        .post('/api/thai-invoices/upload')
        .set('Authorization', `Bearer ${mintTestToken(userA, { expired: true })}`)
        .attach('file', MINIMAL_JPEG, {
          filename: 't.jpg',
          contentType: 'image/jpeg',
        });
      expect(res.status).toBe(401);
    });

    it('upload → list → get by id preserves extraction data', async () => {
      const uploadRes = await request(getApp())
        .post('/api/thai-invoices/upload')
        .set('Authorization', `Bearer ${tokenA()}`)
        .attach('file', MINIMAL_JPEG, {
          filename: 'invoice.jpg',
          contentType: 'image/jpeg',
        });

      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body.success).toBe(true);
      const extractionId = uploadRes.body.data.extractionId as string;
      expect(uploadRes.body.data.data.invoice_number).toBe(
        MOCK_EXTRACTION.invoice_number,
      );

      const listRes = await request(getApp())
        .get('/api/thai-invoices/extractions')
        .set('Authorization', `Bearer ${tokenA()}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.extractions).toHaveLength(1);
      expect(listRes.body.data.extractions[0].id).toBe(extractionId);

      const getRes = await request(getApp())
        .get(`/api/thai-invoices/extractions/${extractionId}`)
        .set('Authorization', `Bearer ${tokenA()}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.extraction.extractionData.cust_code).toBe(
        MOCK_EXTRACTION.cust_code,
      );
      expect(getRes.body.data.extraction.filePath).toMatch(
        new RegExp(`^${extractionId}\\.jpg$`),
      );
    });

    it('GET /files/:id returns stored image bytes', async () => {
      const uploadRes = await request(getApp())
        .post('/api/thai-invoices/upload')
        .set('Authorization', `Bearer ${tokenA()}`)
        .attach('file', MINIMAL_JPEG, {
          filename: 'invoice.jpg',
          contentType: 'image/jpeg',
        });

      const extractionId = uploadRes.body.data.extractionId as string;

      const fileRes = await request(getApp())
        .get(`/api/thai-invoices/files/${extractionId}`)
        .set('Authorization', `Bearer ${tokenA()}`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(fileRes.status).toBe(200);
      expect(fileRes.headers['content-type']).toMatch(/image\/jpeg/);
      expect(Buffer.compare(fileRes.body as Buffer, MINIMAL_JPEG)).toBe(0);
    });

    it('does not allow cross-tenant read of extraction', async () => {
      const uploadRes = await request(getApp())
        .post('/api/thai-invoices/upload')
        .set('Authorization', `Bearer ${tokenA()}`)
        .attach('file', MINIMAL_JPEG, {
          filename: 'invoice.jpg',
          contentType: 'image/jpeg',
        });

      const extractionId = uploadRes.body.data.extractionId as string;

      const getRes = await request(getApp())
        .get(`/api/thai-invoices/extractions/${extractionId}`)
        .set('Authorization', `Bearer ${tokenB()}`);
      expect(getRes.status).toBe(404);
    });

    it('does not allow cross-tenant download of file', async () => {
      const uploadRes = await request(getApp())
        .post('/api/thai-invoices/upload')
        .set('Authorization', `Bearer ${tokenA()}`)
        .attach('file', MINIMAL_JPEG, {
          filename: 'invoice.jpg',
          contentType: 'image/jpeg',
        });

      const extractionId = uploadRes.body.data.extractionId as string;

      const fileRes = await request(getApp())
        .get(`/api/thai-invoices/files/${extractionId}`)
        .set('Authorization', `Bearer ${tokenB()}`);
      expect(fileRes.status).toBe(404);
    });

    it('returns 404 for unknown extraction id', async () => {
      const res = await request(getApp())
        .get('/api/thai-invoices/extractions/00000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ${tokenA()}`);
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid extraction id', async () => {
      const res = await request(getApp())
        .get('/api/thai-invoices/extractions/not-a-uuid')
        .set('Authorization', `Bearer ${tokenA()}`);
      expect(res.status).toBe(400);
    });

    it('rejects unsupported file type', async () => {
      const res = await request(getApp())
        .post('/api/thai-invoices/upload')
        .set('Authorization', `Bearer ${tokenA()}`)
        .attach('file', Buffer.from('plain text'), {
          filename: 'doc.txt',
          contentType: 'text/plain',
        });
      expect(res.status).toBe(415);
    });

    it('rejects list with invalid limit query', async () => {
      const res = await request(getApp())
        .get('/api/thai-invoices/extractions')
        .query({ limit: 'abc' })
        .set('Authorization', `Bearer ${tokenA()}`);
      expect(res.status).toBe(400);
    });

    it('GET /usage returns aggregated token totals after upload', async () => {
      await request(getApp())
        .post('/api/thai-invoices/upload')
        .set('Authorization', `Bearer ${tokenA()}`)
        .attach('file', MINIMAL_JPEG, {
          filename: 'invoice.jpg',
          contentType: 'image/jpeg',
        });

      const usageRes = await request(getApp())
        .get('/api/thai-invoices/usage')
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(usageRes.status).toBe(200);
      expect(usageRes.body.success).toBe(true);
      expect(usageRes.body.data.summary.extractionCount).toBeGreaterThanOrEqual(1);
      expect(usageRes.body.data.summary.tokensTotal).toBeGreaterThan(0);
      expect(usageRes.body.data.pricing.modelName).toBeTruthy();
    });

    it('rejects usage without Authorization', async () => {
      const res = await request(getApp()).get('/api/thai-invoices/usage');
      expect(res.status).toBe(401);
    });
  });
}
