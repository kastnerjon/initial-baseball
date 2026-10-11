import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../../../../../serverCustomNineCompletedAdmission', () => ({
  createServerCustomNineCompletedAdmissionService: vi.fn(),
}));

import { createServerCustomNineCompletedAdmissionService } from '../../../../../../serverCustomNineCompletedAdmission';
import { POST } from './route';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const URL = 'https://example.test/api/custom-nine/challenges/' + ID + '/attempt/submit';
const admit = vi.fn();
const send = (options: RequestInit = {}) => POST(
  new Request(URL, { method: 'POST', headers: { origin: 'https://example.test' }, ...options }),
  { params: Promise.resolve({ puzzleId: ID }) },
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CUSTOM_NINE_RESULT_SUBMISSION_ENABLED', 'true');
  admit.mockResolvedValue({
    kind: 'admitted', status: 'created', submissionId: 'SECRET_ATTEMPT_UUID',
    summary: { points: 36, completed: true, totalAtBats: 9 },
  });
  vi.mocked(createServerCustomNineCompletedAdmissionService).mockReturnValue({ admit } as never);
});
afterEach(() => vi.unstubAllEnvs());

describe('default-disabled Custom Nine authoritative result submission', () => {
  it('returns indistinguishable 404 without invoking admission when the flag is absent or disabled', async () => {
    for (const value of ['', 'false', 'TRUE']) {
      vi.stubEnv('CUSTOM_NINE_RESULT_SUBMISSION_ENABLED', value);
      const response = await send({ headers: { origin: 'https://attacker.test' } });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'not_found' });
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
    expect(admit).not.toHaveBeenCalled();
  });

  it('admits bodyless signed-cookie completions and returns status only', async () => {
    const response = await send({ headers: {
      origin: 'https://example.test', cookie: 'custom_nine_attempt=opaque',
    } });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: 'created' });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(admit).toHaveBeenCalledWith(ID, 'custom_nine_attempt=opaque');
  });

  it('returns HTTP 200 for an exact retry without another result identity', async () => {
    admit.mockResolvedValueOnce({ kind: 'admitted', status: 'existing',
      submissionId: 'PRIVATE_UUID', summary: { points: 4 } });
    const response = await send();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'existing' });
  });

  it('rejects absent or cross-origin headers and client-provided result facts', async () => {
    expect((await send({ headers: {} })).status).toBe(403);
    expect((await send({ headers: { origin: 'https://attacker.test' } })).status).toBe(403);
    expect((await send({ body: '{}' })).status).toBe(400);
    expect((await send({ body: JSON.stringify({ score: 36, submissionId: 'chosen' }) })).status).toBe(400);
    expect(admit).not.toHaveBeenCalled();
  });

  it('accepts an empty request stream and rejects an unbounded nonempty stream', async () => {
    const empty = new ReadableStream<Uint8Array>({
      start(controller) { controller.close(); },
    });
    const accepted = await send({ body: empty, duplex: 'half' } as unknown as RequestInit);
    expect(accepted.status).toBe(201);
    const bad = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{ "points": 36 }'));
        controller.close();
      },
    });
    const rejected = await send({ body: bad, duplex: 'half' } as unknown as RequestInit);
    expect(rejected.status).toBe(400);
    expect(admit).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['not_found', 404, 'not_found'],
    ['invalid_credential', 403, 'invalid_credential'],
    ['incomplete', 409, 'attempt_incomplete'],
  ] as const)('maps %s to sanitized %i', async (kind, status, error) => {
    admit.mockResolvedValueOnce({ kind });
    const response = await send();
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('sanitizes provider, signature, or stored-fact failures', async () => {
    admit.mockRejectedValueOnce(new Error('PRIVATE_SUPABASE_ANSWER_AND_TOKEN'));
    const response = await send();
    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"error":"submission_unavailable"}');
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
