import { describe, expect, it, vi } from 'vitest';
import { createCustomNineAttemptBrowserCredential, createOfficialDailyAttemptBrowserCredential } from './customNineAttemptBrowserCredential';

vi.mock('server-only', () => ({}));

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001';
const secret = 'a-long-secret-for-custom-attempt-browsers-and-tests';
const codec = createCustomNineAttemptBrowserCredential(secret);
const url = 'https://initial-baseball-web.vercel.app/api/custom-nine/challenges/' + ID + '/attempt/bootstrap';

describe('challenge-scoped browser attempt credential', () => {
  it('issues unpredictable, opaque host-only HttpOnly Strict HTTPS cookies', () => {
    const first = codec.issue(ID, url);
    const second = codec.issue(ID, url);
    expect(first.browserKeyDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(first.browserKeyDigest).not.toBe(second.browserKeyDigest);
    expect(first.setCookie).toContain('Path=/api/custom-nine/challenges/' + ID);
    expect(first.setCookie).toContain('; HttpOnly; SameSite=Strict; Secure');
    expect(first.setCookie).not.toContain('Domain=');
    expect(first.setCookie).not.toContain(first.browserKeyDigest);
    const cookie = first.setCookie.split(';')[0]!;
    expect(codec.inspect(cookie, ID)).toEqual({ kind: 'valid', browserKeyDigest: first.browserKeyDigest });
    expect(codec.inspect(cookie, OTHER)).toEqual({ kind: 'absent' });
    expect(codec.issue(ID, url.replace('https:', 'http:')).setCookie).not.toContain('; Secure');
  });

  it('fails closed for duplicate, tampered, malformed, foreign-domain and foreign-secret cookies', () => {
    const pair = codec.issue(ID, url).setCookie.split(';')[0]!;
    const [name, value] = pair.split('=');
    expect(codec.inspect('', ID)).toEqual({ kind: 'absent' });
    expect(codec.inspect(pair + '; ' + pair, ID)).toEqual({ kind: 'invalid' });
    expect(codec.inspect(name + '=garbage', ID)).toEqual({ kind: 'invalid' });
    expect(codec.inspect(name!, ID)).toEqual({ kind: 'invalid' });
    expect(codec.inspect(name + '=' + value!.replace(/.$/, '!'), ID)).toEqual({ kind: 'invalid' });
    const modifiedSignature = value!.slice(0, 44)
      + (value![44] === 'A' ? 'B' : 'A') + value!.slice(45);
    expect(codec.inspect(name + '=' + modifiedSignature, ID)).toEqual({ kind: 'invalid' });
    // A different last character with identical decoded HMAC bytes must still fail.
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const last = value!.slice(-1);
    const n = alphabet.indexOf(last);
    const noncanonical = value!.slice(0, -1) + alphabet[(n & ~3) | ((n + 1) & 3)];
    expect(codec.inspect(name + '=' + noncanonical, ID)).toEqual({ kind: 'invalid' });
    expect(createCustomNineAttemptBrowserCredential('a-second-long-enough-cookie-signing-secret')
      .inspect(pair, ID)).toEqual({ kind: 'invalid' });
    const foreign = codec.issue(OTHER, url).setCookie.split(';')[0]!;
    expect(codec.inspect(foreign, ID)).toEqual({ kind: 'absent' });
  });

  it('rejects weak secrets or malformed challenge IDs', () => {
    expect(() => createCustomNineAttemptBrowserCredential('short')).toThrow();
    expect(() => codec.issue('daily_foo', url)).toThrow();
    expect(() => codec.inspect('', 'not-a-challenge')).toThrow();
  });
});

describe('official Daily scoped credential rotation', () => {
  const edition = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
  const sibling = 'daily-ed-v1-6077ee21-9370-4cf3-aa21-74c50b485591';
  const oldSecret = 'old-official-daily-cookie-secret-0123456789abcdef';
  const newSecret = 'new-official-daily-cookie-secret-0123456789abcdef';
  const origin = 'https://initial-baseball-web.vercel.app/api/daily/editions/' + edition;

  it('keeps the immutable browser digest across rotation without weakening scope', () => {
    const previous = createOfficialDailyAttemptBrowserCredential(oldSecret);
    const issued = previous.issue(edition, origin);
    const cookie = issued.setCookie.split(';')[0]!;
    const rotated = createOfficialDailyAttemptBrowserCredential(newSecret, [oldSecret]);
    expect(rotated.inspect(cookie, edition)).toEqual({
      kind: 'valid', browserKeyDigest: issued.browserKeyDigest,
    });
    expect(rotated.inspect(cookie, sibling)).toEqual({ kind: 'absent' });
    const refresh = rotated.inspect(cookie, edition, origin);
    expect(refresh.kind).toBe('valid');
    if (refresh.kind !== 'valid') throw new Error('Expected legacy cookie to verify');
    const replacement = refresh.replacementSetCookie!;
    expect(replacement).toContain('; HttpOnly; SameSite=Strict; Secure');
    const refreshedCookie = replacement.split(';')[0]!;
    expect(refreshedCookie).not.toBe(cookie);
    expect(createOfficialDailyAttemptBrowserCredential(newSecret)
      .inspect(refreshedCookie, edition))
      .toEqual({ kind: 'valid', browserKeyDigest: issued.browserKeyDigest });
    expect(previous.inspect(refreshedCookie, edition)).toEqual({ kind: 'invalid' });
    expect(createOfficialDailyAttemptBrowserCredential(newSecret).inspect(cookie, edition))
      .toEqual({ kind: 'invalid' });
    const fresh = rotated.issue(edition, origin);
    expect(createOfficialDailyAttemptBrowserCredential(newSecret)
      .inspect(fresh.setCookie.split(';')[0]!, edition))
      .toMatchObject({ kind: 'valid', browserKeyDigest: fresh.browserKeyDigest });
    expect(previous.inspect(fresh.setCookie.split(';')[0]!, edition)).toEqual({ kind: 'invalid' });
  });

  it('refuses malformed legacy verifier keys', () => {
    expect(() => createOfficialDailyAttemptBrowserCredential(newSecret, ['short'])).toThrow();
  });
});
