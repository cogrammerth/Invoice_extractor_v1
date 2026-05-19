import { describe, expect, it } from 'vitest';

import { ApiClientError } from './api.types';

describe('ApiClientError', () => {
  it('stores field-level errors when provided', () => {
    const err = new ApiClientError(400, 'VALIDATION_ERROR', 'Invalid extraction', [
      { field: 'invoice_number', message: 'Required field' },
    ]);
    expect(err.status).toBe(400);
    expect(err.fieldErrors).toHaveLength(1);
    expect(err.fieldErrors?.[0]?.field).toBe('invoice_number');
  });
});
