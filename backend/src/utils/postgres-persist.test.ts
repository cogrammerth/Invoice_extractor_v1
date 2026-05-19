import { describe, expect, it } from 'vitest';

import {
  mapExtractionPersistError,
  prepareExtractionJsonb,
  sanitizeForPostgresJson,
} from './postgres-persist.js';

describe('sanitizeForPostgresJson', () => {
  it('removes null bytes from strings', () => {
    const withNull = `a${'\0'}b`;
    expect(sanitizeForPostgresJson(withNull)).toBe('ab');
  });

  it('sanitizes nested objects', () => {
    const input = {
      invoice_number: `X${'\0'}`,
      nested: { note: `y${'\0'}z` },
    };
    expect(prepareExtractionJsonb(input as never)).toEqual({
      invoice_number: 'X',
      nested: { note: 'yz' },
    });
  });
});

describe('mapExtractionPersistError', () => {
  it('maps missing file_path column', () => {
    const mapped = mapExtractionPersistError({
      code: '42703',
      message: 'column "file_path" of relation "extractions" does not exist',
    });
    expect(mapped.code).toBe('DATABASE_SCHEMA_OUT_OF_DATE');
    expect(mapped.message).toContain('db:migrate');
  });
});
