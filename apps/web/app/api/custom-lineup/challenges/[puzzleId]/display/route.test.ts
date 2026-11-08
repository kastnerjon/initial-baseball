import { describe, expect, it, vi } from 'vitest';
vi.mock('../../../../../serverCustomV2CompletionDisplayHttp', () => ({
  handleCustomV2CompletionDisplayHttp: vi.fn(async (_r, _c, mode) =>
    Response.json({ method: mode })),
}));
import { GET, POST } from './route';
import { handleCustomV2CompletionDisplayHttp } from '../../../../../serverCustomV2CompletionDisplayHttp';

describe('exact-puzzle Custom completion-display route method binding', () => {
  const context = { params: Promise.resolve({
    puzzleId: 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000',
  }) };
  it('delegates GET exclusively to the scoped read handler', async () => {
    const req = new Request('https://initial.test/');
    expect(await (await GET(req, context)).json()).toEqual({ method: 'GET' });
    expect(handleCustomV2CompletionDisplayHttp).toHaveBeenCalledWith(req, context, 'GET');
  });
  it('delegates POST exclusively to the scoped write handler', async () => {
    const req = new Request('https://initial.test/', { method: 'POST' });
    expect(await (await POST(req, context)).json()).toEqual({ method: 'POST' });
    expect(handleCustomV2CompletionDisplayHttp).toHaveBeenCalledWith(req, context, 'POST');
  });
});
