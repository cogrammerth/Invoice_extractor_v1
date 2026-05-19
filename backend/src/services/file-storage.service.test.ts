/**
 * Unit tests for local file storage (temp directory).
 */

import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createFileStorageService } from './file-storage.service.js';

const EXTRACTION_ID = '11111111-1111-4111-8111-111111111111';

describe('createFileStorageService', () => {
  let uploadDir: string;

  beforeEach(async () => {
    uploadDir = await mkdtemp(path.join(os.tmpdir(), 'invoice-upload-'));
  });

  afterEach(async () => {
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('saves and reads a file by extraction id', async () => {
    const storage = createFileStorageService(uploadDir);
    const buffer = Buffer.from('fake-image');
    const relative = await storage.saveFile(
      EXTRACTION_ID,
      buffer,
      'image/jpeg',
    );
    expect(relative).toBe(`${EXTRACTION_ID}.jpg`);

    const read = await storage.readFile(EXTRACTION_ID, relative);
    expect(read.equals(buffer)).toBe(true);
  });

  it('rejects path traversal in stored path', async () => {
    const storage = createFileStorageService(uploadDir);
    await expect(
      storage.readFile(EXTRACTION_ID, '../outside.jpg'),
    ).rejects.toThrow(/Invalid file path|escapes/);
  });

  it('rejects invalid extraction id', async () => {
    const storage = createFileStorageService(uploadDir);
    await expect(
      storage.saveFile('not-a-uuid', Buffer.from('x'), 'image/png'),
    ).rejects.toThrow(/Invalid extraction id/);
  });
});
