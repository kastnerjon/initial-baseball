import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  DAILY_ADMIN_AUTH_CHALLENGE,
  DailyAdminAuthorizationError,
  requireDailyAdminPrincipal,
} from './dailyAdminAuthorization';

const ADMIN_USERNAME = 'daily-editor';
const ADMIN_PASSWORD = 'a-secure-admin-password-with-32-chars';
const ENVIRONMENT = {
  DAILY_ADMIN_USERNAME: ADMIN_USERNAME,
  DAILY_ADMIN_PASSWORD: ADMIN_PASSWORD,
};

describe('Daily admin authorization', () => {
  it('authenticates the configured single editor and supplies a stable actor ID', () => {
    expect(requireDailyAdminPrincipal(
      basicAuthorization(ADMIN_USERNAME, ADMIN_PASSWORD),
      ENVIRONMENT,
    )).toEqual({ actorId: ADMIN_USERNAME });
  });

  it('supports a colon inside the password by splitting only the username delimiter', () => {
    const password = `${ADMIN_PASSWORD}:second-factor-text`;

    expect(requireDailyAdminPrincipal(
      basicAuthorization(ADMIN_USERNAME, password),
      { ...ENVIRONMENT, DAILY_ADMIN_PASSWORD: password },
    )).toEqual({ actorId: ADMIN_USERNAME });
  });

  it('rejects missing, malformed, or incorrect credentials uniformly', () => {
    const rejectedHeaders: Array<string | null> = [
      null,
      'Bearer token',
      basicAuthorization('wrong-editor', ADMIN_PASSWORD),
      basicAuthorization(ADMIN_USERNAME, 'wrong-password-that-is-long-enough'),
    ];

    for (const authorizationHeader of rejectedHeaders) {
      expect(() => requireDailyAdminPrincipal(authorizationHeader, ENVIRONMENT)).toThrowError(
        expect.objectContaining({
          kind: 'unauthorized',
          message: 'Daily administration credentials were not accepted.',
        }),
      );
    }
  });

  it('fails closed when server credentials are misconfigured', () => {
    const cases: Array<[Record<string, string | undefined>, string]> = [
      [{ DAILY_ADMIN_PASSWORD: ADMIN_PASSWORD }, 'DAILY_ADMIN_USERNAME'],
      [{ DAILY_ADMIN_USERNAME: 'editor:invalid', DAILY_ADMIN_PASSWORD: ADMIN_PASSWORD }, 'DAILY_ADMIN_USERNAME'],
      [{ DAILY_ADMIN_USERNAME: ADMIN_USERNAME, DAILY_ADMIN_PASSWORD: 'too-short' }, 'DAILY_ADMIN_PASSWORD'],
    ];

    for (const [environment, variableName] of cases) {
      expect(() => requireDailyAdminPrincipal(null, environment)).toThrowError(
        expect.objectContaining({
          kind: 'misconfigured',
          message: expect.stringContaining(variableName),
        }),
      );
    }
  });

  it('exports the Basic challenge future admin routes must return with a 401 response', () => {
    expect(DAILY_ADMIN_AUTH_CHALLENGE).toBe(
      'Basic realm="Initial Baseball Daily Admin", charset="UTF-8"',
    );
    expect(new DailyAdminAuthorizationError('unauthorized', 'message').name)
      .toBe('DailyAdminAuthorizationError');
  });
});

function basicAuthorization(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
}
