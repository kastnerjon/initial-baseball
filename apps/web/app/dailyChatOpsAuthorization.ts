import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;
const MINIMUM_TOKEN_LENGTH = 32;

export type DailyChatOpsAuthorizationErrorKind = 'misconfigured' | 'unauthorized';

export class DailyChatOpsAuthorizationError extends Error {
  constructor(
    readonly kind: DailyChatOpsAuthorizationErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'DailyChatOpsAuthorizationError';
  }
}

export interface DailyChatOpsPrincipal {
  actorId: 'chatops:github';
}

export function requireDailyChatOpsPrincipal(
  authorizationHeader: string | null,
  environment: Record<string, string | undefined> = process.env,
): DailyChatOpsPrincipal {
  const configuredToken = environment.DAILY_CHATOPS_TOKEN;
  if (!configuredToken || configuredToken.length < MINIMUM_TOKEN_LENGTH) {
    throw new DailyChatOpsAuthorizationError(
      'misconfigured',
      `DAILY_CHATOPS_TOKEN must contain at least ${MINIMUM_TOKEN_LENGTH} characters.`,
    );
  }

  const suppliedToken = authorizationHeader?.match(BEARER_PATTERN)?.[1]?.trim();
  if (!suppliedToken || !secureEqual(suppliedToken, configuredToken)) {
    throw new DailyChatOpsAuthorizationError('unauthorized', 'Daily ChatOps credentials were not accepted.');
  }

  return { actorId: 'chatops:github' };
}

function secureEqual(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left, 'utf8').digest();
  const rightDigest = createHash('sha256').update(right, 'utf8').digest();
  return timingSafeEqual(leftDigest, rightDigest);
}
