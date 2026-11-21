import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../../../dailyAdminComposition', () => ({ createDailyAdminContext: vi.fn(() => ({ actorId: 'editor', repository: {} })) }));
vi.mock('../../../dailyAdminWorkflow', () => ({ DailyAdminWorkflowError: class extends Error {}, createDailyAdminWorkflow: vi.fn(() => ({ replaceSelection })) }));
import { POST } from './route';
const replaceSelection = vi.hoisted(() => vi.fn(async () => ({})));
beforeEach(() => { replaceSelection.mockClear(); });
afterEach(() => vi.clearAllMocks());
it('redirects after a successful explicit replacement without the selected player in the URL', async () => {
  const response = await POST(new Request('https://example.test/admin/daily/replace', {
    method: 'POST', headers: { origin: 'https://example.test' },
    body: new URLSearchParams({ puzzleDate: '2030-01-01', slot: '1', canonicalPlayerId: 'private-player' }),
  }));
  expect(response.status).toBe(303);
  expect(replaceSelection).toHaveBeenCalledOnce();
  const destination = new URL(response.headers.get('location')!);
  expect(destination.searchParams.get('updated')).toBe('1');
  expect(destination.searchParams.has('playerId')).toBe(false);
  expect(destination.href).not.toContain('private-player');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
