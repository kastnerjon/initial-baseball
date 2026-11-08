import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

const mocked = vi.hoisted(() => ({
  create: vi.fn(), owner: vi.fn(),
}));
vi.mock('./serverCustomV2CompletionDisplayService', () => ({
  createServerCustomV2CompletionDisplayService: mocked.create,
}));
vi.mock('./serverCustomLineupV2AccountCreatorExclusion', () => ({
  inspectCustomLineupV2AccountCreator: mocked.owner,
}));
import { handleCustomV2CompletionDisplayHttp } from './serverCustomV2CompletionDisplayHttp';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const URL = 'https://initial.test/api/custom-lineup/challenges/' + ID + '/display';
const COOKIE = 'opaque-first-attempt-cookie=token';
const write = vi.fn();
const read = vi.fn();

type Method = 'GET' | 'POST';
function send(method: Method, body?: unknown, options: {
  headers?: Record<string, string>; url?: string; puzzleId?: string;
} = {}) {
  const url = options.url ?? URL;
  const request = new Request(url, {
    method,
    headers: {
      origin: new URL(url).origin, 'sec-fetch-site': 'same-origin', cookie: COOKIE,
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
    ...(method === 'POST' && body !== undefined
      ? { body: typeof body === 'string' ? body : JSON.stringify(body) }
      : {}),
  });
  return handleCustomV2CompletionDisplayHttp(request,
    { params: Promise.resolve({ puzzleId: options.puzzleId ?? ID }) }, method);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CUSTOM_V2_COMPLETION_DISPLAY_ENABLED', 'true');
  mocked.create.mockReturnValue({ write, read });
  mocked.owner.mockResolvedValue({ owner: false, finish: (r: Response) => r });
  write.mockResolvedValue({ kind: 'saved', status: 'created' });
  read.mockResolvedValue({ kind: 'loaded', choice: null });
});
afterEach(() => vi.unstubAllEnvs());

describe('off-by-default exact-attempt Custom completion display HTTP', () => {
  it('returns 404 with no auth/session/database access unless the independent flag is exact true', async () => {
    for (const flag of ['', 'false', 'TRUE', ' true ']) {
      vi.stubEnv('CUSTOM_V2_COMPLETION_DISPLAY_ENABLED', flag);
      for (const method of ['GET', 'POST'] as const) {
        const result = await send(method, { mode: 'anonymous' });
        expect(result.status).toBe(404);
        expect(await result.json()).toEqual({ error: 'not_found' });
        expect(result.headers.get('cache-control')).toBe('private, no-store');
        expect(result.headers.get('vary')).toBe('Cookie');
      }
    }
    expect(mocked.owner).not.toHaveBeenCalled();
    expect(mocked.create).not.toHaveBeenCalled();
  });

  it('rejects cross-site, same-site and missing Fetch Metadata before private reads', async () => {
    for (const method of ['GET','POST'] as const) {
      for (const site of ['cross-site', 'same-site', '']) {
        expect((await send(method, { mode: 'anonymous' }, {
          headers: { 'sec-fetch-site': site },
        })).status).toBe(403);
      }
      expect((await send(method, { mode: 'anonymous' }, {
        headers: { origin: 'https://attacker.test' },
      })).status).toBe(403);
    }
    expect(mocked.owner).not.toHaveBeenCalled();
  });

  it('allows first-party GET direct navigation but POST requires matching Origin and same-origin context', async () => {
    expect((await send('GET', undefined, {
      headers: { 'sec-fetch-site': 'none', origin: '' },
    })).status).toBe(403);
    expect((await send('GET', undefined, {
      headers: { 'sec-fetch-site': 'none' },
    })).status).toBe(200);
    expect((await send('POST', { mode: 'anonymous' }, {
      headers: { 'sec-fetch-site': 'none' },
    })).status).toBe(403);
  });

  it('denies URL identity/replay query parameters and malformed puzzle IDs before account checks', async () => {
    for (const method of ['GET','POST'] as const) {
      expect((await send(method, { mode: 'anonymous' }, {
        url: URL + '?submissionId=forged',
      })).status).toBe(400);
      expect((await send(method, { mode: 'anonymous' }, {
        puzzleId: 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000',
      })).status).toBe(404);
    }
    expect(mocked.owner).not.toHaveBeenCalled();
  });

  it('rejects non-JSON, invalid, oversized and forged-length submissions before account checks', async () => {
    expect((await send('POST', { mode: 'named', displayName: 'Guest' }, {
      headers: { 'content-type': 'text/plain' },
    })).status).toBe(415);
    expect((await send('POST', '{ invalid json')).status).toBe(400);
    expect((await send('POST', { mode: 'named', displayName: 'x'.repeat(700) }, {
      headers: { 'content-length': '4' },
    })).status).toBe(413);
    expect((await send('POST', undefined)).status).toBe(400);
    expect(mocked.owner).not.toHaveBeenCalled();
  });

  it('submits a scoped choice with no browser-selected score/attempt identity and no name echo', async () => {
    const choice = { mode: 'named', displayName: 'Guest Hero' };
    const result = await send('POST', choice);
    expect(result.status).toBe(201);
    const payload = await result.json();
    expect(payload).toEqual({ status: 'created' });
    expect(result.headers.get('x-content-type-options')).toBe('nosniff');
    expect(write).toHaveBeenCalledWith(ID, COOKIE, choice);
    expect(JSON.stringify(payload)).not.toContain('Guest Hero');
    write.mockResolvedValueOnce({ kind: 'saved', status: 'existing' });
    const retried = await send('POST', choice);
    expect(retried.status).toBe(200);
    expect(await retried.json()).toEqual({ status: 'existing' });
  });

  it('returns saved named or Anonymous choice only to the cookie holder on private GET', async () => {
    read.mockResolvedValueOnce({
      kind: 'loaded', choice: { mode: 'named', displayName: '<script>text</script>' },
    });
    const named = await send('GET');
    expect(named.status).toBe(200);
    expect(named.headers.get('content-type')).toContain('application/json');
    expect(await named.json()).toEqual({
      status: 'saved', mode: 'named', displayName: '<script>text</script>',
    });
    expect(read).toHaveBeenCalledWith(ID, COOKIE);
    read.mockResolvedValueOnce({
      kind: 'loaded', choice: { mode: 'anonymous', displayName: null },
    });
    expect(await (await send('GET')).json()).toEqual({
      status: 'saved', mode: 'anonymous',
    });
    expect(await (await send('GET')).json()).toEqual({ status: 'unselected' });
  });

  it('blocks a verified cross-device creator and preserves session refresh', async () => {
    mocked.owner.mockResolvedValueOnce({
      owner: true,
      finish: (r: Response) => { r.headers.set('set-cookie', 'sb-session=renewed'); return r; },
    });
    const result = await send('POST', { mode: 'named', displayName: 'Owner' });
    expect(result.status).toBe(403);
    expect(result.headers.get('set-cookie')).toContain('sb-session=renewed');
    expect(write).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('maps invalid/unauthorized/conflict/backend errors without leaking private details', async () => {
    for (const [kind, status] of [
      ['invalid',400], ['unauthorized',403], ['conflict',409], ['unavailable',503],
    ] as const) {
      write.mockResolvedValueOnce({ kind });
      const result = await send('POST', { mode: 'anonymous' });
      expect(result.status).toBe(status);
      expect(JSON.stringify(await result.json())).not.toContain('PRIVATE_SQL');
    }
    read.mockResolvedValueOnce({ kind: 'unavailable' });
    expect((await send('GET')).status).toBe(503);
    read.mockResolvedValueOnce({ kind: 'unauthorized' });
    expect((await send('GET')).status).toBe(403);
  });

  it('redacts account verification outages while preserving an already queued auth-cookie finisher', async () => {
    mocked.owner.mockImplementationOnce(async (_r: Request, _id: string, _c: string,
      onFinish: (fn: (r: Response) => Response) => void) => {
      onFinish((r: Response) => {
        r.headers.set('set-cookie', 'sb-session=refreshed'); return r;
      });
      throw new Error('PRIVATE_AUTH_DETAILS');
    });
    const response = await send('POST', { mode: 'anonymous' });
    expect(response.status).toBe(503);
    expect(response.headers.get('set-cookie')).toContain('sb-session=refreshed');
    expect(JSON.stringify(await response.json())).not.toContain('PRIVATE_AUTH_DETAILS');
    expect(write).not.toHaveBeenCalled();
  });
});
