import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('./serverArchiveBetaDailyActivation', async importOriginal => ({
  ...await importOriginal<typeof import('./serverArchiveBetaDailyActivation')>(),
  issueActivatedArchiveBetaDaily: vi.fn(),
}));
import { POST } from './admin/daily/archive-beta/issue/route';
import { ArchiveBetaActivationError, issueActivatedArchiveBetaDaily } from './serverArchiveBetaDailyActivation';
const issue = vi.mocked(issueActivatedArchiveBetaDaily);
const password = 'a-secure-admin-password-with-32-chars';
const auth = `Basic ${Buffer.from(`editor:${password}`).toString('base64')}`;

function request({ authorization = auth, origin = 'https://example.com', body = 'puzzleDate=2026-10-04' } = {}) {
  return new Request('https://example.com/admin/daily/archive-beta/issue', {
    method: 'POST', body, headers: { authorization, origin, 'content-type': 'application/x-www-form-urlencoded' },
  });
}
beforeEach(() => {
  vi.stubEnv('DAILY_ADMIN_USERNAME', 'editor');
  vi.stubEnv('DAILY_ADMIN_PASSWORD', password);
  issue.mockReset();
  issue.mockResolvedValue({ status: 'created', puzzleDate: '2026-10-04', dailyNumber: 1, issuedAt: '2026-10-05T01:00:00.000Z' });
});
afterEach(() => vi.unstubAllEnvs());

describe('archive-beta admin issuance POST', () => {
  it('rejects cross-origin requests before issuance', async () => {
    expect((await POST(request({ origin: 'https://evil.example' }))).status).toBe(403);
    expect(issue).not.toHaveBeenCalled();
  });
  it('requires existing admin credentials before parsing or issuance', async () => {
    const response = await POST(request({ authorization: '', body: 'not a puzzle' }));
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('Basic');
    expect(issue).not.toHaveBeenCalled();
  });
  it.each(['', 'puzzleDate=bad', 'puzzleDate=2026-10-04&puzzleDate=2026-10-05'])('rejects invalid form %s', async body => {
    expect((await POST(request({ body }))).status).toBe(400);
    expect(issue).not.toHaveBeenCalled();
  });
  it('redirects to a metadata-only no-store confirmation', async () => {
    const response = await POST(request());
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://example.com/admin/daily?betaIssued=2026-10-04');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.text()).not.toContain('player');
  });
  it.each([['invalid-date', 400], ['immutable-conflict', 409], ['read-back-failed', 503]] as const)('sanitizes %s', async (kind, status) => {
    issue.mockRejectedValueOnce(new ArchiveBetaActivationError(kind));
    expect((await POST(request())).status).toBe(status);
  });
  it('does not serialize provider diagnostics or puzzle content', async () => {
    issue.mockRejectedValueOnce(new Error('secret player-id and clue payload'));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('secret');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
