import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

const mocked = vi.hoisted(() => ({
  inspect: vi.fn(),
  read: vi.fn(),
  record: vi.fn(),
}));
vi.mock('./serverCustomLineupV2AccountCreatorExclusion', () => ({
  inspectCustomLineupV2AccountCreator: mocked.inspect,
}));
vi.mock('./serverCustomV2CompletionDisplay', () => ({
  createServerCustomV2CompletionDisplayService: vi.fn(() => ({ record: mocked.record })),
}));
vi.mock('./serverCustomV2CompletionDisplayRead', () => ({
  createServerCustomV2CompletionDisplayReadService: vi.fn(() => ({ read: mocked.read })),
}));

import { handleCustomV2CompletionDisplay } from './serverCustomV2CompletionDisplayHttp';
const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const URL = 'https://example.test/api/custom-lineup/challenges/' + ID + '/completion/display';
const context = (id: string = ID) => ({ params: Promise.resolve({ puzzleId: id }) });
function get(url = URL, origin?: string): Request {
  return new Request(url, { headers: {
    cookie: 'private-signed-cookie',
    ...(origin === undefined ? {} : { origin }),
  } });
}
function post(body: unknown = { mode: 'named', displayName: '  Avi  ' },
  options: { origin?: string | null; contentType?: string; url?: string } = {},
): Request {
  const origin = options.origin === undefined ? 'https://example.test' : options.origin;
  return new Request(options.url ?? URL, {
    method: 'POST',
    headers: {
      cookie: 'private-signed-cookie',
      ...(origin === null ? {} : { origin }),
      'content-type': options.contentType ?? 'application/json',
    },
    body: JSON.stringify(body),
  });
}
async function assertNoSecrets(response: Response): Promise<void> {
  const body = JSON.stringify(await response.json());
  for (const text of ['PRIVATE_SQL','PRIVATE_SCORE','PRIVATE_ACCOUNT','private-signed-cookie',
    'submissionId','canonicalPlayerIds','clueSnapshot']) {
    expect(body).not.toContain(text);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED', 'true');
  vi.stubEnv('CUSTOM_V2_COMPLETION_DISPLAY_ENABLED', 'true');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mocked.inspect.mockResolvedValue({ owner: false, finish: (r: Response) => r });
  mocked.record.mockResolvedValue({ kind: 'saved', status: 'created' });
  mocked.read.mockResolvedValue({ kind: 'not_set' });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('default-OFF same-browser Custom v2 completion display HTTP', () => {
  it('rejects non-exact true flags before any authorization or body parsing', async () => {
    for (const [game, names] of [
      ['false', 'true'], ['true', 'false'], ['TRUE', 'true'],
      ['true', ' true '], ['', 'true'], ['true', ''],
    ]) {
      vi.stubEnv('CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED', game);
      vi.stubEnv('CUSTOM_V2_COMPLETION_DISPLAY_ENABLED', names);
      expect((await handleCustomV2CompletionDisplay(post(), context(), 'record')).status)
        .toBe(404);
      expect((await handleCustomV2CompletionDisplay(get(), context(), 'read')).status)
        .toBe(404);
    }
    expect(mocked.inspect).not.toHaveBeenCalled();
    expect(mocked.read).not.toHaveBeenCalled();
    expect(mocked.record).not.toHaveBeenCalled();
  });

  it('writes only through the signed service, reflecting neither the name nor a result ID', async () => {
    const response = await handleCustomV2CompletionDisplay(post(), context(), 'record');
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: 'created' });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Cookie');
    expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(mocked.record).toHaveBeenCalledWith(ID, 'private-signed-cookie', {
      mode: 'named', displayName: '  Avi  ',
    });
    expect(mocked.read).not.toHaveBeenCalled();
  });

  it('restores saved named/Anonymous only through signed service, or returns not_set', async () => {
    mocked.read.mockResolvedValueOnce({ kind: 'found', display: {
      mode: 'anonymous', displayName: null,
    } });
    const anon = await handleCustomV2CompletionDisplay(get(), context(), 'read');
    expect(anon.status).toBe(200);
    expect(await anon.json()).toEqual({ status: 'saved', mode: 'anonymous', displayName: null });
    mocked.read.mockResolvedValueOnce({ kind: 'found', display: {
      mode: 'named', displayName: 'Guest',
    } });
    const named = await handleCustomV2CompletionDisplay(get(), context(), 'read');
    expect(await named.json()).toEqual({ status: 'saved', mode: 'named', displayName: 'Guest' });
    expect(await (await handleCustomV2CompletionDisplay(get(), context(), 'read')).json())
      .toEqual({ status: 'not_set' });
    expect(mocked.read).toHaveBeenCalledWith(ID, 'private-signed-cookie');
    expect(mocked.record).not.toHaveBeenCalled();
  });

  it('preserves exact retry without re-issuing score or reflecting supplied identity', async () => {
    mocked.record.mockResolvedValueOnce({ kind: 'saved', status: 'existing' });
    const response = await handleCustomV2CompletionDisplay(
      post({ mode: 'anonymous' }), context(), 'record',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'existing' });
    expect(mocked.read).not.toHaveBeenCalled();
  });

  it('rejects CSRF origins, query strings and wrong media types before privileged auth', async () => {
    for (const request of [
      post(undefined, { origin: null }),
      post(undefined, { origin: 'https://other.test' }),
      post(undefined, { contentType: 'text/plain' }),
      post(undefined, { url: URL + '?submissionId=LEAK' }),
    ]) {
      expect((await handleCustomV2CompletionDisplay(request, context(), 'record')).status)
        .toBeGreaterThanOrEqual(400);
    }
    expect((await handleCustomV2CompletionDisplay(get(URL + '?x=1'), context(), 'read')).status)
      .toBe(400);
    expect((await handleCustomV2CompletionDisplay(get(URL, 'https://other.test'), context(), 'read')).status)
      .toBe(403);
    expect(mocked.inspect).not.toHaveBeenCalled();
    expect(mocked.record).not.toHaveBeenCalled();
    expect(mocked.read).not.toHaveBeenCalled();
  });

  it('refuses verified owner and leaves display and score services unused', async () => {
    mocked.inspect.mockResolvedValueOnce({ owner: true, finish: (r: Response) => r });
    const response = await handleCustomV2CompletionDisplay(post(), context(), 'record');
    expect(response.status).toBe(403);
    expect(mocked.record).not.toHaveBeenCalled();
    expect(mocked.read).not.toHaveBeenCalled();
  });

  it('maps strictly bounded signed-service errors without leaking provider details', async () => {
    for (const [kind, status] of [
      ['not_found', 404], ['disabled', 404], ['invalid_credential', 403],
      ['invalid_choice', 400],
    ] as const) {
      mocked.record.mockResolvedValueOnce({ kind });
      const response = await handleCustomV2CompletionDisplay(post(), context(), 'record');
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: kind });
    }
    mocked.read.mockResolvedValueOnce({ kind: 'invalid_credential' });
    expect((await handleCustomV2CompletionDisplay(get(), context(), 'read')).status).toBe(403);
  });

  it('preserves Auth session refresh and redacts internal SQL/score failures', async () => {
    mocked.inspect.mockImplementationOnce(async (_req: Request, _id: string,
      _cookie: string, onFinish: (fn: (r: Response) => Response) => void,
    ) => {
      const finish = (r: Response) => { r.headers.set('x-refreshed-auth', 'yes'); return r; };
      onFinish(finish);
      return { owner: false, finish };
    });
    mocked.record.mockRejectedValueOnce(new Error('PRIVATE_SCORE_AND_SQL'));
    const response = await handleCustomV2CompletionDisplay(post(), context(), 'record');
    expect(response.status).toBe(503);
    expect(response.headers.get('x-refreshed-auth')).toBe('yes');
    await assertNoSecrets(response);
    expect(console.error).toHaveBeenCalledWith(JSON.stringify({
      event: 'custom_v2_completion_display_unavailable', action: 'record', status: 503,
    }));
  });

  it('rejects invalid challenge, oversized and malformed JSON before privileged auth', async () => {
    const invalid = await handleCustomV2CompletionDisplay(
      post(), context('custom-nine-v1-123e4567-e89b-42d3-a456-426614174000'), 'record',
    );
    expect(invalid.status).toBe(404);
    expect(mocked.inspect).not.toHaveBeenCalled();
    const big = await handleCustomV2CompletionDisplay(post({
      mode: 'named', displayName: 'x'.repeat(5000),
    }), context(), 'record');
    expect(big.status).toBe(400);
    const malformed = new Request(URL, {
      method: 'POST', headers: { origin: 'https://example.test',
        'content-type': 'application/json' },
      body: '{not valid json',
    });
    expect((await handleCustomV2CompletionDisplay(malformed, context(), 'record')).status)
      .toBe(400);
    expect(mocked.inspect).not.toHaveBeenCalled();
  });
});
