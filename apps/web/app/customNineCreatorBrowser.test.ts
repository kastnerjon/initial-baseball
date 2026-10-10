import { describe, expect, it } from 'vitest';
import { createCustomNineCreatorBrowserMarker } from './customNineCreatorBrowser';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001';
const marker = createCustomNineCreatorBrowserMarker('a-test-progression-secret-that-is-long-enough');

describe('Custom Nine creating-browser marker', () => {
  it('sets a host-only, challenge-scoped HttpOnly marker on HTTPS issuance', () => {
    const cookie = marker.creatorCookie(ID, 'https://initial-baseball-web.vercel.app/api/custom-nine/challenges');
    expect(cookie).toContain(`Path=/api/custom-nine/challenges/${ID}`);
    expect(cookie).toContain('; HttpOnly; SameSite=Strict; Secure');
    expect(cookie).toContain('Max-Age=');
    expect(cookie).not.toContain('Domain=');
    expect(marker.inspect(cookie.split(';')[0], ID)).toBe('creator');
    expect(marker.inspect(cookie.split(';')[0], OTHER)).toBe('unmarked');
  });

  it('allows local HTTP testing without setting Secure', () => {
    expect(marker.creatorCookie(ID, 'http://localhost:3000/api/custom-nine/challenges'))
      .not.toContain('; Secure');
  });

  it('distinguishes unmarked browsers from tampered and duplicated markers', () => {
    const pair = marker.creatorCookie(ID, 'https://example.test').split(';')[0];
    expect(marker.inspect(null, ID)).toBe('unmarked');
    expect(marker.inspect('', ID)).toBe('unmarked');
    expect(marker.inspect(pair.replace(/.$/, '.'), ID)).toBe('invalid');
    expect(marker.inspect(`${pair}; ${pair}`, ID)).toBe('invalid');
    expect(marker.inspect(`${pair.split('=')[0]}=garbage`, ID)).toBe('invalid');
  });

  it('rejects cross-secret signatures and malformed challenge IDs', () => {
    const pair = marker.creatorCookie(ID, 'https://example.test').split(';')[0];
    const alien = createCustomNineCreatorBrowserMarker('different-long-enough-test-progression-secret');
    expect(alien.inspect(pair, ID)).toBe('invalid');
    expect(() => marker.creatorCookie('daily-2026-10-10', 'https://example.test')).toThrow();
    expect(() => marker.inspect(pair, 'invalid-id')).toThrow();
  });

  it('fails before issuance when signing configuration is weak', () => {
    expect(() => createCustomNineCreatorBrowserMarker('short')).toThrow();
  });
});
