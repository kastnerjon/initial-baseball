import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  DailyChatOpsAuthorizationError,
  requireDailyChatOpsPrincipal,
} from './dailyChatOpsAuthorization';

const TOKEN = '0123456789abcdef0123456789abcdef';

describe('Daily ChatOps authorization', () => {
  it('accepts the configured bearer token and records a fixed audit actor', () => {
    expect(requireDailyChatOpsPrincipal(`Bearer ${TOKEN}`, {
      DAILY_CHATOPS_TOKEN: TOKEN,
    })).toEqual({ actorId: 'chatops:github' });
  });

  it('rejects missing or incorrect bearer tokens without exposing the configured token', () => {
    for (const authorizationHeader of [null, 'Bearer wrong-token']) {
      expect(() => requireDailyChatOpsPrincipal(authorizationHeader, {
        DAILY_CHATOPS_TOKEN: TOKEN,
      })).toThrow(DailyChatOpsAuthorizationError);
    }
  });

  it('fails closed when the machine token is absent or too short', () => {
    for (const DAILY_CHATOPS_TOKEN of [undefined, 'too-short']) {
      try {
        requireDailyChatOpsPrincipal(`Bearer ${TOKEN}`, { DAILY_CHATOPS_TOKEN });
        throw new Error('expected authorization failure');
      } catch (error) {
        expect(error).toMatchObject({ kind: 'misconfigured' });
      }
    }
  });
});
