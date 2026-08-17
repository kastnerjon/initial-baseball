import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  resolveAtBat: vi.fn(),
}));

vi.mock('../../../serverCanonicalRuntime', () => ({
  dailyRuntime: runtime,
}));

import { POST } from './route';

describe('POST /api/daily/resolve', () => {
  beforeEach(() => {
    runtime.resolveAtBat.mockReset();
  });

  it('reports server processing time without making the response cacheable', async () => {
    runtime.resolveAtBat.mockResolvedValue({
      result: {
        kind: 'incorrect',
        revealedCount: 0,
        strikeCount: 1,
      },
      reveal: null,
      progressionToken: 'next-token',
      hintBundle: null,
    });

    const response = await POST(createRequest({
      progressionToken: 'token',
      submittedPlayerId: 'player-id',
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('server-timing')).toMatch(/^daily-resolve;dur=\d+$/);
    expect(runtime.resolveAtBat).toHaveBeenCalledWith({
      progressionToken: 'token',
      submittedPlayerId: 'player-id',
    });
  });

  it('reports timing on rejected requests too', async () => {
    const response = await POST(createRequest({}));

    expect(response.status).toBe(400);
    expect(response.headers.get('server-timing')).toMatch(/^daily-resolve;dur=\d+$/);
    expect(runtime.resolveAtBat).not.toHaveBeenCalled();
  });
});

function createRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/daily/resolve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
