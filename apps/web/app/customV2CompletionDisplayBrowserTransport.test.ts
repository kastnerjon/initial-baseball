import { describe, expect, it, vi } from 'vitest';
import {
  createCustomV2CompletionDisplayBrowserTransport,
  decodeCustomV2CompletionDisplayRead, decodeCustomV2CompletionDisplayWrite,
  CustomV2CompletionDisplayTransportError,
} from './customV2CompletionDisplayBrowserTransport';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const PATH = '/api/custom-lineup/challenges/' + ID + '/completion/display';
function setup(body: unknown, status = 200) {
  const fetcher = vi.fn(async () => Response.json(body, { status }));
  return { fetcher, transport: createCustomV2CompletionDisplayBrowserTransport(
    fetcher as unknown as typeof fetch,
  ) };
}
describe('Custom v2 original-result named/Anonymous browser transport', () => {
  it('requests private no-store same-origin read with no token or query parameters', async () => {
    const s = setup({ status: 'saved', mode: 'named', displayName: 'Zoë & Avi' });
    expect(await s.transport.read(ID)).toEqual({ mode: 'named', displayName: 'Zoë & Avi' });
    expect(s.fetcher).toHaveBeenCalledWith(PATH, {
      method: 'GET', credentials: 'same-origin', cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    expect(JSON.stringify(s.fetcher.mock.calls)).not.toContain('submissionId');
    expect(JSON.stringify(s.fetcher.mock.calls)).not.toContain('PRIVATE_');
  });
  it('preserves Anonymous null and distinguishes no choice yet from saved', async () => {
    expect(await setup({ status: 'saved', mode: 'anonymous', displayName: null })
      .transport.read(ID)).toEqual({ mode: 'anonymous', displayName: null });
    expect(await setup({ status: 'not_set' }).transport.read(ID)).toBeNull();
  });
  it('sends only normalized named/Anonymous choices and returns idempotent retry status', async () => {
    const s = setup({ status: 'created' }, 201);
    expect(await s.transport.record(ID, { mode: 'named', displayName: 'Avi' }))
      .toBe('created');
    expect(s.fetcher).toHaveBeenCalledWith(PATH, expect.objectContaining({
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: '{"mode":"named","displayName":"Avi"}',
    }));
    const anon = setup({ status: 'existing' });
    expect(await anon.transport.record(ID, { mode: 'anonymous' })).toBe('existing');
    expect(anon.fetcher).toHaveBeenCalledWith(PATH, expect.objectContaining({
      body: '{"mode":"anonymous"}',
    }));
  });
  it('rejects privacy-contaminated or malformed readback bodies', () => {
    for (const value of [
      {}, [], { status: 'saved', mode: 'named', displayName: ' x ' },
      { status: 'saved', mode: 'anonymous', displayName: 'LEAK' },
      { status: 'saved', mode: 'named', displayName: 'x'.repeat(33) },
      { status: 'saved', mode: 'named', displayName: 'Guest', score: 4 },
      { status: 'not_set', submissionId: 'PRIVATE_ID' },
      { status: 'created' },
    ]) expect(() => decodeCustomV2CompletionDisplayRead(value))
      .toThrow(CustomV2CompletionDisplayTransportError);
    for (const value of [{ status: 'created', submissionId: 'PRIVATE_ID' },
      { status: 'saved' }, { status: 'other' }, null]) {
      expect(() => decodeCustomV2CompletionDisplayWrite(value))
        .toThrow(CustomV2CompletionDisplayTransportError);
    }
  });
  it('refuses bad name, foreign ID and extra client fields before network access', async () => {
    const s = setup({ status: 'created' });
    for (const value of [
      { mode: 'named', displayName: ' x ' },
      { mode: 'named', displayName: 'x'.repeat(33) },
      { mode: 'named', displayName: 'A\nB' },
      { mode: 'named', displayName: '😀'.repeat(17) },
      { mode: 'anonymous', displayName: null },
      { mode: 'named', displayName: 'Avi', submissionId: 'FOREIGN' },
    ]) {
      await expect(s.transport.record(ID, value as never)).rejects
        .toBeInstanceOf(CustomV2CompletionDisplayTransportError);
    }
    await expect(s.transport.record('custom-nine-v1-123e4567-e89b-42d3-a456-426614174000',
      { mode: 'anonymous' })).rejects.toThrow();
    expect(s.fetcher).not.toHaveBeenCalled();
  });
  it('does not swallow 403, 503, malformed JSON or network errors', async () => {
    await expect(setup({ error: 'invalid_credential' }, 403).transport.read(ID))
      .rejects.toMatchObject({ kind: 'invalid_credential' });
    await expect(setup({ error: 'session_unavailable' }, 503).transport.record(ID,
      { mode: 'anonymous' })).rejects.toMatchObject({ kind: 'unavailable' });
    const malformed = createCustomV2CompletionDisplayBrowserTransport(
      vi.fn(async () => new Response('{bad-json', { status: 200 })) as unknown as typeof fetch);
    await expect(malformed.read(ID)).rejects.toMatchObject({ kind: 'unavailable' });
    const crashed = createCustomV2CompletionDisplayBrowserTransport(
      vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch);
    await expect(crashed.read(ID)).rejects.toThrow('offline');
  });
});
