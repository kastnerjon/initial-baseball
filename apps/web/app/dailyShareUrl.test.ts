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
  });

  it('handles configured origins with trailing slashes', () => {
    setSiteUrl('https://example.com///');

    expect(createDailyShareUrl()).toBe('https://example.com/');
  });

  it('does not hardcode initialbaseball.com', () => {
    setSiteUrl('https://alpha.example.com');

    expect(createDailyShareUrl()).not.toContain('initialbaseball.com');
  });

  it('falls back to browser origin when the env var is missing', () => {
    setSiteUrl(undefined);
    setBrowserOrigin('https://preview.example.com');

    expect(createDailyShareUrl()).toBe('https://preview.example.com/');
  });

  it('falls back safely to the existing homepage route with no origin available', () => {
    setSiteUrl(undefined);

    expect(createDailyShareUrl()).toBe('/');
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
