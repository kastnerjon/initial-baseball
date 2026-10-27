import { describe, expect, it } from 'vitest';
import { isCreation } from './MyCreationsClient';

const item = {
  puzzleId: 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000',
  issuedAt: '2026-10-26T20:00:00.000Z',
  title: 'The 1998 Yankees',
};

describe('My Creations safe public list parser', () => {
  it('accepts a valid non-BMP Unicode title under the shared code-point limit', () => {
    expect(isCreation({ ...item, title: '⚾'.repeat(40) })).toBe(true);
    expect(isCreation({ ...item, title: '⚾'.repeat(60) })).toBe(true);
  });

  it('rejects titles the canonical parser rejects without changing any other response fields', () => {
    for (const title of ['⚾'.repeat(61), '<script>', 'a', '\u200b', '', '\nBad Title']) {
      expect(isCreation({ ...item, title })).toBe(false);
    }
  });

  it('rejects spoofed IDs, malformed timestamps and non-object responses', () => {
    expect(isCreation({ ...item, puzzleId: '../wrong' })).toBe(false);
    expect(isCreation({ ...item, issuedAt: 'invalid-date' })).toBe(false);
    expect(isCreation(null)).toBe(false);
    expect(isCreation(['oops'])).toBe(false);
  });
});
