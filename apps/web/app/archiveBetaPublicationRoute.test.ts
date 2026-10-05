import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('./serverSupabaseClient', () => ({ createServerSupabaseClient: vi.fn(() => ({})) }));
vi.mock('./supabaseDailyPuzzleRepository', () => ({ createSupabaseDailyPuzzleRepository: vi.fn(() => ({})) }));
vi.mock('./serverArchiveBetaDailyPublication', async importOriginal => ({
  ...await importOriginal<typeof import('./serverArchiveBetaDailyPublication')>(), transitionDailyLifecycleWithArchiveBeta: vi.fn(),
}));
import { POST } from './admin/daily/lifecycle/route';
import { ArchiveBetaPublicationError, transitionDailyLifecycleWithArchiveBeta } from './serverArchiveBetaDailyPublication';
import { createServerSupabaseClient } from './serverSupabaseClient';
const transition = vi.mocked(transitionDailyLifecycleWithArchiveBeta);
const password = 'a-secure-admin-password-with-32-chars';
const auth = `Basic ${Buffer.from(`editor:${password}`).toString('base64')}`;
function request({ authorization = auth, origin = 'https://example.com', body = 'puzzleDate=2026-10-08&action=publish' } = {}) {
  return new Request('https://example.com/admin/daily/lifecycle', { method: 'POST', body,
    headers: { authorization, origin, 'content-type': 'application/x-www-form-urlencoded' } });
}
beforeEach(() => {
  vi.stubEnv('DAILY_ADMIN_USERNAME', 'editor'); vi.stubEnv('DAILY_ADMIN_PASSWORD', password);
  vi.clearAllMocks(); transition.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());
describe('archive publication admin boundary', () => {
  it.each([['', 'https://example.com', 401], [auth, 'https://evil.example', 403]])('rejects unauthorized/origin before provider I/O', async (authorization, origin, status) => {
    const response = await POST(request({ authorization, origin }));
    expect(response.status).toBe(status);
    expect(createServerSupabaseClient).not.toHaveBeenCalled(); expect(transition).not.toHaveBeenCalled();
  });
  it('awaits verified completion and returns a metadata-only no-store redirect', async () => {
    const response = await POST(request());
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://example.com/admin/daily?lifecycle=publish&puzzleDate=2026-10-08');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(transition).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actorId: 'editor', action: 'publish', puzzleDate: '2026-10-08' }));
  });
  it('reports partial completion with a safe retry instruction', async () => {
    transition.mockRejectedValueOnce(new ArchiveBetaPublicationError());
    const response = await POST(request());
    expect(response.status).toBe(503); expect(await response.text()).toContain('Verify archive copy');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('reports immutable conflict as non-retryable without revealing content', async () => {
    transition.mockRejectedValueOnce(new ArchiveBetaPublicationError('immutable-conflict'));
    const response = await POST(request());
    expect(response.status).toBe(409);
    const text = await response.text();
    expect(text).toContain('Editorial review is required');
    expect(text).not.toContain('Verify archive copy');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('never serializes unexpected provider or answer content', async () => {
    transition.mockRejectedValueOnce(new Error('secret canonical player and hints'));
    const response = await POST(request());
    expect(response.status).toBe(409); expect(await response.text()).not.toContain('secret');
  });
});
