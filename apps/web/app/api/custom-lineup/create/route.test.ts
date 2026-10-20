import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../../serverCustomLineupCreationBudget', () => ({
  reservePublicCustomLineupCreation: vi.fn(),
}));
vi.mock('../../../serverCustomLineupV2Creation', () => {
  class ServerCustomLineupV2CreationError extends Error {
    constructor(readonly kind: string) { super('private-hint-do-not-leak'); }
  }
  return { createServerCustomLineupV2CreationService: vi.fn(), ServerCustomLineupV2CreationError };
});
vi.mock('../../../serverCustomLineupV2GameplayHttp', () => ({
  isCustomLineupV2GameplayTransportEnabled: (env: Record<string, string | undefined>) =>
    env.CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED === 'true',
}));

import { POST } from './route';
import { reservePublicCustomLineupCreation } from '../../../serverCustomLineupCreationBudget';
import {
  createServerCustomLineupV2CreationService,
  ServerCustomLineupV2CreationError,
} from '../../../serverCustomLineupV2Creation';

const BASE_URL = 'https://example.test/api/custom-lineup/create';
const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const issue = vi.fn();
const OWNER = 'A'.repeat(43);
const reserve = vi.mocked(reservePublicCustomLineupCreation);

beforeEach(() => {
  vi.stubEnv('CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED', 'true');
  vi.stubEnv('CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED', 'true');
  vi.stubEnv('DAILY_PROGRESSION_SECRET', 'private-test-progression-secret-long-enough');
  issue.mockReset();
  issue.mockResolvedValue({ puzzleId: ID, ownerCapability: OWNER });
  reserve.mockReset();
  reserve.mockResolvedValue({ allowed: true });
  vi.mocked(createServerCustomLineupV2CreationService).mockReturnValue({ issueAnonymous: issue, issue: vi.fn() });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

function request(ids: string[] = ['ibp_00000000000000000001'], headers: Record<string, string> = {}, url = BASE_URL) {
  return new Request(url, {
    method: 'POST',
    headers: { origin: new URL(url).origin, 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ canonicalPlayerIds: ids, title: '1998 Yankees Legends' }),
  });
}

describe('default-disabled, anonymous Custom v2 creation', () => {
  it('remains closed unless both issuance and gameplay gates are enabled', async () => {
    vi.stubEnv('CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED', '');
    expect((await POST(request())).status).toBe(404);
    vi.stubEnv('CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED', 'true');
    vi.stubEnv('CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED', '');
    expect((await POST(request())).status).toBe(404);
    expect(reserve).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it('issues 1–10 anonymous selections only after quota admission, never returning answers', async () => {
    for (let length = 1; length <= 10; length++) {
      const ids = Array.from({ length }, (_, i) => 'ibp_' + String(i + 1).padStart(20, '0'));
      const response = await POST(request(ids));
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ puzzleId: ID, ownerCapability: OWNER });
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(JSON.stringify(response.headers)).not.toContain(OWNER);
      expect(response.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Strict; Secure');
      expect(response.headers.get('set-cookie')).toContain('ib-custom-lineup-creator-v2-');
      expect(issue).toHaveBeenLastCalledWith({ canonicalPlayerIds: ids }, '1998 Yankees Legends');
    }
    expect(reserve).toHaveBeenCalledTimes(10);
    expect(issue).toHaveBeenCalledTimes(10);
  });

  it('never reserves for cross-origin or malformed media/body requests', async () => {
    expect((await POST(request(undefined, { origin: 'https://attacker.test' }))).status).toBe(403);
    expect((await POST(request(undefined, { origin: '' }))).status).toBe(403);
    expect((await POST(request(undefined, { 'content-type': 'text/plain' }))).status).toBe(400);
    expect((await POST(request(undefined, {}, BASE_URL + '?override=1'))).status).toBe(400);
    const tooLarge = request();
    const huge = new Request(tooLarge, { body: JSON.stringify({ canonicalPlayerIds: ['x'.repeat(5000)] }) });
    expect((await POST(huge)).status).toBe(413);
    expect(reserve).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it('requires a bounded name and rejects invalid public payloads before quota', async () => {
    for (const payload of [
      { canonicalPlayerIds: ['ibp_00000000000000000001'] },
      { canonicalPlayerIds: [], title: '' },
      { canonicalPlayerIds: [], title: 'x' },
      { canonicalPlayerIds: [], title: '<script>' },
      { canonicalPlayerIds: [], title: '\uFE0F\uFE0F\uFE0F' },
      { canonicalPlayerIds: [], title: 'Valid', publish: true },
      { canonicalPlayerIds: [], title: 'x'.repeat(61) },
    ]) {
      const original = request();
      const response = await POST(new Request(original, { body: JSON.stringify(payload) }));
      expect(response.status).toBe(400);
    }
    expect(reserve).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it('rejects malformed, duplicate and out-of-range selections without reserving quota', async () => {
    const id = 'ibp_00000000000000000001';
    const cases: unknown[] = [
      [], Array(11).fill(id), [id, id], [''], [' '], ['leading '],
      [4], [null], [id, 4], 'not-an-array', null, {}, [id.repeat(15)],
    ];
    for (const canonicalPlayerIds of cases) {
      const response = await POST(new Request(request(), {
        body: JSON.stringify({ canonicalPlayerIds, title: 'A valid lineup title' }),
      }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'invalid_selection' });
      expect(response.headers.has('set-cookie')).toBe(false);
    }
    expect(reserve).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it('normalizes a whitespace-heavy name and submits only the title to private issuer', async () => {
    const original = request();
    const response = await POST(new Request(original, {
      body: JSON.stringify({ canonicalPlayerIds: ['ibp_00000000000000000001'], title: '  The   Big Red  Machine ' }),
    }));
    expect(response.status).toBe(201);
    expect(issue).toHaveBeenCalledWith({
      canonicalPlayerIds: ['ibp_00000000000000000001'],
    }, 'The Big Red Machine');
  });

  it('returns 429 with retry-after and does not issue on a denied reservation', async () => {
    reserve.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 199 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('199');
    expect(await response.json()).toEqual({ error: 'creation_limit_reached' });
    expect(response.headers.has('set-cookie')).toBe(false);
    expect(issue).not.toHaveBeenCalled();
  });

  it('fails closed for budget provider errors or missing signing configuration', async () => {
    reserve.mockRejectedValueOnce(new Error('secret DB stacktrace'));
    const result = await POST(request());
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ error: 'creation_unavailable' });
    expect(issue).not.toHaveBeenCalled();
    vi.stubEnv('DAILY_PROGRESSION_SECRET', 'short');
    expect((await POST(request())).status).toBe(503);
    expect(reserve).toHaveBeenCalledOnce();
  });

  it('maps only approved issuance error codes without revealing hints', async () => {
    for (const [kind, status] of [
      ['invalid_selection', 400], ['unsupported_players', 422], ['immutable_conflict', 409],
    ] as const) {
      issue.mockRejectedValueOnce(new ServerCustomLineupV2CreationError(kind));
      const result = await POST(request());
      expect(result.status).toBe(status);
      expect(await result.json()).toEqual({ error: kind });
    }
  });
});
