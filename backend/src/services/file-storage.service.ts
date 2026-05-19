/**
 * Local disk storage for uploaded invoice images.
 */

import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIME_TO_EXT: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export interface FileStorageService {
  saveFile(
    extractionId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string>;
  readFile(extractionId: string, storedRelativePath: string): Promise<Buffer>;
  deleteFile(extractionId: string, storedRelativePath: string): Promise<void>;
}

function assertSafeExtractionId(extractionId: string): void {
  if (!UUID_RE.test(extractionId)) {
    throw new Error('Invalid extraction id');
  }
}

function resolveStoredPath(uploadDir: string, relativePath: string): string {
  const normalized = path.normalize(relativePath);
  if (normalized.includes('..') || path.isAbsolute(normalized)) {
    throw new Error('Invalid file path');
  }
  const absolute = path.resolve(uploadDir, normalized);
  const uploadRoot = path.resolve(uploadDir);
  if (!absolute.startsWith(uploadRoot + path.sep) && absolute !== uploadRoot) {
    throw new Error('Path escapes upload directory');
  }
  return absolute;
}

export function createFileStorageService(uploadDir: string): FileStorageService {
  const root = path.resolve(uploadDir);

  async function ensureDir(): Promise<void> {
    await mkdir(root, { recursive: true });
  }

  return {
    async saveFile(extractionId, buffer, mimeType) {
      assertSafeExtractionId(extractionId);
      const ext = MIME_TO_EXT[mimeType];
      if (ext === undefined) {
        throw new Error(`Unsupported mime type for storage: ${mimeType}`);
      }
      await ensureDir();
      const relative = `${extractionId}${ext}`;
      const absolute = resolveStoredPath(root, relative);
      await writeFile(absolute, buffer);
      return relative;
    },

    async readFile(extractionId, storedRelativePath) {
      assertSafeExtractionId(extractionId);
      await ensureDir();
      const absolute = resolveStoredPath(root, storedRelativePath);
      if (!storedRelativePath.startsWith(extractionId)) {
        throw new Error('File path does not match extraction id');
      }
      return readFile(absolute);
    },

    async deleteFile(extractionId, storedRelativePath) {
      assertSafeExtractionId(extractionId);
      const absolute = resolveStoredPath(root, storedRelativePath);
      try {
        await unlink(absolute);
      } catch {
        /* missing file is ok */
      }
    },
  };
}
