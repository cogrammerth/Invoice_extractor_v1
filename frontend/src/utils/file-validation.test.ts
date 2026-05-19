import { describe, expect, it } from 'vitest';

import { validateInvoiceFile } from './file-validation';

function mockFile(partial: Partial<File> & { type: string; size: number }): File {
  return {
    name: 'test.jpg',
    ...partial,
  } as File;
}

describe('validateInvoiceFile', () => {
  it('accepts allowed mime types under size limit', () => {
    const result = validateInvoiceFile(
      mockFile({ type: 'image/jpeg', size: 1024 }),
    );
    expect(result.valid).toBe(true);
  });

  it('rejects unsupported mime types', () => {
    const result = validateInvoiceFile(
      mockFile({ type: 'application/pdf', size: 1024 }),
    );
    expect(result.valid).toBe(false);
    expect(result.message).toContain('JPEG');
  });

  it('rejects files over 20 MB', () => {
    const result = validateInvoiceFile(
      mockFile({ type: 'image/png', size: 21 * 1024 * 1024 }),
    );
    expect(result.valid).toBe(false);
    expect(result.message).toContain('20 MB');
  });

  it('rejects empty files', () => {
    const result = validateInvoiceFile(
      mockFile({ type: 'image/webp', size: 0 }),
    );
    expect(result.valid).toBe(false);
    expect(result.message).toContain('empty');
  });
});
