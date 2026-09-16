import { afterEach, describe, expect, it } from 'vitest';
import { createDailyShareUrl } from './dailyShareUrl';

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  setSiteUrl(originalSiteUrl);
  delete (globalThis as { location?: unknown }).location;
});

describe('createDailyShareUrl', () => {
  it('uses NEXT_PUBLIC_SITE_URL when configured', () => {
    setSiteUrl('https://example.com');

    expect(createDailyShareUrl()).toBe('https://example.com/');
    expect(createDailyShareUrl('/classic')).toBe('https://example.com/classic');
  });

  it('handles configured origins with trailing slashes', () => {
    setSiteUrl('https://example.com///');

    expect(createDailyShareUrl()).toBe('https://example.com/');
    expect(createDailyShareUrl('/classic')).toBe('https://example.com/classic');
  });

  it('does not hardcode initialbaseball.com', () => {
    setSiteUrl('https://alpha.example.com');

    expect(createDailyShareUrl()).not.toContain('initialbaseball.com');
  });

  it('falls back to browser origin when the env var is missing', () => {
    setSiteUrl(undefined);
    setBrowserOrigin('https://preview.example.com');

    expect(createDailyShareUrl()).toBe('https://preview.example.com/');
    expect(createDailyShareUrl('/classic')).toBe('https://preview.example.com/classic');
  });

  it('falls back safely to the requested route with no origin available', () => {
    setSiteUrl(undefined);

    expect(createDailyShareUrl()).toBe('/');
    expect(createDailyShareUrl('/classic')).toBe('/classic');
  });
});

function setSiteUrl(value: string | undefined): void {
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    return;
  }

  process.env.NEXT_PUBLIC_SITE_URL = value;
}

function setBrowserOrigin(origin: string): void {
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { origin },
  });
}
