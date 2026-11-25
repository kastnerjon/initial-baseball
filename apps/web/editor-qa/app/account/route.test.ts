import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

const ctx = vi.hoisted(() => ({
  config: vi.fn(), session: vi.fn(), login: vi.fn(), finish: vi.fn(response => response),
}));
vi.mock('../../../app/officialDailyMcpConsent', () => ({ readOfficialDailyMcpConsentConfig: ctx.config }));
vi.mock('../../../app/serverCreatorAccountAuth', async load => ({
  ...await load<typeof import('../../../app/serverCreatorAccountAuth')>(),
  creatorAuthClient: () => ({ client: { auth: { signInWithPassword: ctx.login } }, finish: ctx.finish }),
  inspectCreatorAccountSession: ctx.session,
}));
vi.mock('server-only', () => ({}));
const origin = 'https://qa.example.test';
function request(method: string, incomingOrigin = origin) {
  return new NextRequest(origin + '/account', { method, headers: { host: 'qa.example.test',
    origin: incomingOrigin, 'content-type': 'application/x-www-form-urlencoded' },
    ...(method === 'POST' ? { body: 'email=test%40example.test&password=fixture' } : {}) });
}
beforeEach(() => {
  vi.clearAllMocks();
  ctx.config.mockReturnValue({ creator: { origin }, editorId: 'editor' });
  ctx.login.mockResolvedValue({ error: null });
});
it('keeps sign-in hidden when consent is disabled and rejects cross-origin forms before authentication', async () => {
  ctx.config.mockReturnValueOnce(null);
  expect((await GET(request('GET'))).status).toBe(404);
  expect((await POST(request('POST', 'https://other.example.test'))).status).toBe(403);
  expect(ctx.login).not.toHaveBeenCalled();
});
it('withholds session cookies from a valid non-editor account', async () => {
  ctx.session.mockResolvedValue({ kind: 'verified', id: 'other' });
  expect((await POST(request('POST'))).status).toBe(403);
  expect(ctx.finish).not.toHaveBeenCalled();
});
it('commits the verified editor session and redirects to the same QA host', async () => {
  ctx.session.mockResolvedValue({ kind: 'verified', id: 'editor' });
  const response = await POST(request('POST'));
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe(origin + '/account');
  expect(ctx.finish).toHaveBeenCalledOnce();
});
