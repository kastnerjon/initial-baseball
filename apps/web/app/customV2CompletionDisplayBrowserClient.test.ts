import { describe, expect, it, vi } from 'vitest';
import {
  createCustomV2CompletionDisplayBrowserClient, CustomCompletionDisplayError,
} from './customV2CompletionDisplayBrowserClient';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const PATH = '/api/custom-lineup/challenges/' + ID + '/display';
function setup(body: unknown = { status: 'unselected' }, status = 200) {
  const fetchPort = vi.fn(async (_url: string, _init: RequestInit) => Response.json(body, { status }));
  return { fetchPort, client: createCustomV2CompletionDisplayBrowserClient(fetchPort) };
}

describe('Custom v2 browser completion-name transport', () => {
  it('loads only the signed-cookie holder’s own saved named or Anonymous choice', async () => {
    const n = setup({ status: 'saved', mode: 'named', displayName: '<script>text</script>' });
    expect(await n.client.read(ID)).toEqual({ mode: 'named', displayName: '<script>text</script>' });
    expect(n.fetchPort).toHaveBeenCalledWith(PATH, expect.objectContaining({
      method: 'GET', credentials: 'same-origin', cache: 'no-store',
    }));
    expect(await setup({ status: 'saved', mode: 'anonymous' }).client.read(ID))
      .toEqual({ mode: 'anonymous' });
    expect(await setup().client.read(ID)).toBeNull();
  });

  it('saves an explicit choice with no submission identity or score, idempotently', async () => {
    const n = setup({ status: 'created' }, 201);
    expect(await n.client.save(ID, { mode: 'named', displayName: 'Guest' })).toBe('created');
    const [url, init] = n.fetchPort.mock.calls[0]!;
    expect(url).toBe(PATH);
    expect(init).toMatchObject({
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: '{"mode":"named","displayName":"Guest"}',
    });
    expect(init.body).not.toContain('submissionId');
    expect(init.body).not.toContain('score');
    expect(await setup({ status: 'existing' }).client.save(ID, { mode: 'anonymous' }))
      .toBe('existing');
  });

  it('refuses a foreign/v1 puzzle, untrimmed or malformed names before I/O', async () => {
    const s = setup();
    for (const id of ['', 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000']) {
      await expect(s.client.read(id)).rejects.toMatchObject({ kind: 'invalid' });
    }
    for (const choice of [
      { mode: 'named', displayName: ' Guest ' },
      { mode: 'named', displayName: 'x'.repeat(33) },
      { mode: 'named', displayName: 'Guest\nName' },
      { mode: 'named', displayName: '🧢'.repeat(17) },
      { mode: 'anonymous', displayName: 'LEAK' },
      { mode: 'named', displayName: 'Guest', submissionId: 'chosen' },
    ]) await expect(s.client.save(ID, choice as never))
      .rejects.toMatchObject({ kind: 'invalid' });
    expect(s.fetchPort).not.toHaveBeenCalled();
  });

  it('rejects malformed server data and never infers a saved identity', async () => {
    for (const data of [
      null, [], { status: 'saved', mode: 'named', displayName: ' Guest ' },
      { status: 'saved', mode: 'named', displayName: null },
      { status: 'saved', mode: 'anonymous', displayName: 'LEAK' },
      { status: 'saved', mode: 'anonymous', submissionId: 'spoof' },
      { status: 'unselected', score: 4 },
    ]) await expect(setup(data).client.read(ID))
      .rejects.toMatchObject({ kind: 'unavailable' });
    for (const data of [null, { status: 'created', submissionId: 'secret' },
      { status: 'unselected' }]) {
      await expect(setup(data).client.save(ID, { mode: 'anonymous' }))
        .rejects.toMatchObject({ kind: 'unavailable' });
    }
  });

  it('maps forbidden, immutable conflict, invalid request and provider outages safely', async () => {
    for (const [status, kind] of [
      [400, 'invalid'], [403, 'unauthorized'], [409, 'conflict'],
      [404, 'unavailable'], [503, 'unavailable'],
    ] as const) {
      const s = setup({ error: 'PRIVATE_SQL_DETAILS' }, status);
      await expect(s.client.save(ID, { mode: 'anonymous' }))
        .rejects.toMatchObject({ kind });
    }
    const failed = createCustomV2CompletionDisplayBrowserClient(vi.fn(async () => {
      throw new Error('PRIVATE_NETWORK_DETAIL');
    }));
    await expect(failed.read(ID)).rejects.toThrow(CustomCompletionDisplayError);
    await expect(failed.read(ID)).rejects.toMatchObject({ kind: 'unavailable' });
  });
});
