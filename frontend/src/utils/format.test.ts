import { describe, expect, it } from 'vitest';

import { formatDuration, formatUsd } from './format';

describe('formatUsd', () => {
  it('formats USD with currency symbol', () => {
    const formatted = formatUsd(1.25);
    expect(formatted).toMatch(/1\.25/);
    expect(formatted).toMatch(/\$/);
  });
});

describe('formatDuration', () => {
  it('shows milliseconds under one second', () => {
    expect(formatDuration(450)).toBe('450 ms');
  });

  it('shows seconds at or above one second', () => {
    expect(formatDuration(1500)).toBe('1.50 s');
  });
});
