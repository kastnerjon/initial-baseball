import { expect, it, vi } from 'vitest';
import { POST as atBat } from './api/daily/at-bats/route';
import { POST as completion } from './api/daily/results/route';
import { getAuthoritativeDailyResultPuzzle } from './serverCanonicalRuntime';
import { createServerSupabaseClient } from './serverSupabaseClient';

vi.mock('server-only', () => ({}));
vi.mock('./getPacificDailyDateString', () => ({ getPacificDailyDateString: () => '2026-11-06' }));
vi.mock('./serverCanonicalRuntime', () => ({ getAuthoritativeDailyResultPuzzle: vi.fn() }));
vi.mock('./serverSupabaseClient', () => ({ createServerSupabaseClient: vi.fn() }));

it.each([
  ['/api/daily/at-bats', atBat],
  ['/api/daily/results', completion],
] as const)('rejects a secondary edition at %s before puzzle lookup or persistence', async (path, post) => {
  const request = new Request('https://example.test' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schemaVersion: 1,
      puzzleId: 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08',
      puzzleDate: '2026-11-06',
      rulesetVersion: 'points-v4',
    }),
  });
  const response = await post(request);
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'invalid_puzzle' });
  expect(getAuthoritativeDailyResultPuzzle).not.toHaveBeenCalled();
  expect(createServerSupabaseClient).not.toHaveBeenCalled();
});
