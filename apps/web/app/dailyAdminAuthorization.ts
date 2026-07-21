import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

const BASIC_AUTH_PATTERN = /^Basic\s+([A-Za-z0-9+/]+={0,2})$/i;
const MINIMUM_PASSWORD_LENGTH = 32;

export const DAILY_ADMIN_AUTH_CHALLENGE =
  'Basic realm="Initial Baseball Daily Admin", charset="UTF-8"';

export type DailyAdminAuthorizationErrorKind = 'misconfigured' | 'unauthorized';

export class DailyAdminAuthorizationError extends Error {
  constructor(
    readonly kind: DailyAdminAuthorizationErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'DailyAdminAuthorizationError';
  }
}

export interface DailyAdminPrincipal {
  actorId: string;
}

export function requireDailyAdminPrincipal(
  authorizationHeader: string | null,
  environment: Record<string, string | undefined> = process.env,
): DailyAdminPrincipal {
  const configured = readConfiguredCredentials(environment);
  const supplied = decodeBasicAuthorization(authorizationHeader);

  if (supplied === null) throwUnauthorized();

  const usernameMatches = secureEqual(supplied.username, configured.username);
  const passwordMatches = secureEqual(supplied.password, configured.password);
  if (!usernameMatches || !passwordMatches) throwUnauthorized();

  return { actorId: configured.username };
}

function readConfiguredCredentials(
  environment: Record<string, string | undefined>,
): { username: string; password: string } {
  const username = environment.DAILY_ADMIN_USERNAME?.trim();
  const password = environment.DAILY_ADMIN_PASSWORD;

  if (!username || username.includes(':')) {
    throw new DailyAdminAuthorizationError(
      'misconfigured',
      'DAILY_ADMIN_USERNAME must be configured without a colon.',
    );
  }
  if (!password || password.length < MINIMUM_PASSWORD_LENGTH) {
    throw new DailyAdminAuthorizationError(
      'misconfigured',
      `DAILY_ADMIN_PASSWORD must contain at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
    );
  }

  return { username, password };
}

function decodeBasicAuthorization(
  authorizationHeader: string | null,
): { username: string; password: string } | null {
  const match = authorizationHeader?.match(BASIC_AUTH_PATTERN);
  const encoded = match?.[1];
  if (encoded === undefined) return null;

  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex <= 0) return null;

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function secureEqual(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left, 'utf8').digest();
  const rightDigest = createHash('sha256').update(right, 'utf8').digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function throwUnauthorized(): never {
  throw new DailyAdminAuthorizationError(
    'unauthorized',
    'Daily administration credentials were not accepted.',
  );
}
