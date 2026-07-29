import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { GET } from './admin/auth/route';
import { DAILY_ADMIN_AUTH_CHALLENGE } from './dailyAdminAuthorization';
import {
  DAILY_ADMIN_AUTH_PATH,
  DAILY_ADMIN_PATH,
  getBasicAuthProtectionSpace,
} from './dailyAdminPaths';

const ADMIN_USERNAME = 'daily-editor';
const ADMIN_PASSWORD = 'a-secure-admin-password-with-32-chars';

beforeEach(() => {
  vi.stubEnv('DAILY_ADMIN_USERNAME', ADMIN_USERNAME);
  vi.stubEnv('DAILY_ADMIN_PASSWORD', ADMIN_PASSWORD);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Daily admin authentication route', () => {
  it('places the challenge in a protection space that contains the admin page', () => {
    const protectionSpace = getBasicAuthProtectionSpace(DAILY_ADMIN_AUTH_PATH);

    expect(protectionSpace).toBe('/admin/');
    expect(DAILY_ADMIN_PATH.startsWith(protectionSpace)).toBe(true);
  });

  it('returns the Basic challenge without credentials', () => {
    const response = GET(new Request(`https://example.com${DAILY_ADMIN_AUTH_PATH}`));

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(DAILY_ADMIN_AUTH_CHALLENGE);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('redirects valid credentials to the Daily admin page', () => {
    const response = GET(new Request(`https://example.com${DAILY_ADMIN_AUTH_PATH}`, {
      headers: { authorization: basicAuthorization(ADMIN_USERNAME, ADMIN_PASSWORD) },
    }));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`https://example.com${DAILY_ADMIN_PATH}`);
  });
});

function basicAuthorization(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
}
