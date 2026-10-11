import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../../../../../serverCustomNineComparison', () => ({
  createServerCustomNineComparisonService: vi.fn(),
}));

import { createServerCustomNineComparisonService } from '../../../../../../serverCustomNineComparison';
import { GET } from './route';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const URL = 'https://example.test/api/custom-nine/challenges/' + ID + '/attempt/comparison';
const read = vi.fn();
const send = (url = URL, headers: Record<string, string> = {}, puzzleId = ID) => GET(
  new Request(url, { headers }),
  { params: Promise.resolve({ puzzleId }) },
);
const hist = Array.from({ length: 73 }, (_, index) => index === 49 ? 1 : 0);
const abHist = Array.from({ length: 9 }, (_, index) => index === 1 ? 1 : 0);
const result = {
  kind: 'ready',
  completed: { completedGameCount: 1, averageTotalPoints: 24.5, scoreHistogram: hist },
  atBats: Array.from({ length: 9 }, (_, index) => ({
    pitchNumber: index + 1, resolvedAtBatCount: 1,
    averagePoints: 0.5, scoreHistogram: abHist,
  })),
  // A compromised/widened service projection must never reach the browser.
  submissionId: 'PRIVATE_UUID', playerId: 'SECRET_CANONICAL_PLAYER',
  token: 'SECRET_SIGNED_TOKEN', playerName: 'PRIVATE_PLAYER_NAME',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CUSTOM_NINE_COMPARISON_READ_ENABLED', 'true');
  vi.stubEnv('CUSTOM_NINE_RESULT_SUBMISSION_ENABLED', 'true');
  read.mockResolvedValue(result);
  vi.mocked(createServerCustomNineComparisonService).mockReturnValue({ read } as never);
});
afterEach(() => vi.unstubAllEnvs());

describe('gated Custom Nine comparison-read API', () => {
  it('returns 404 before provider access unless both feature flags are explicitly true', async () => {
    for (const [comparison, submission] of [
      ['', 'true'], ['false', 'true'], ['TRUE', 'true'],
      ['true', ''], ['true', 'false'], ['true', 'TRUE'],
    ]) {
      vi.stubEnv('CUSTOM_NINE_COMPARISON_READ_ENABLED', comparison);
      vi.stubEnv('CUSTOM_NINE_RESULT_SUBMISSION_ENABLED', submission);
      const response = await send(URL, { origin: 'https://attacker.test' });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'not_found' });
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
    expect(createServerCustomNineComparisonService).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('passes only immutable challenge parameter and request cookie, never arbitrary exclusions', async () => {
    const response = await send(URL, { cookie: 'signed_custom_browser=opaque' });
    expect(response.status).toBe(200);
    expect(read).toHaveBeenCalledWith(ID, 'signed_custom_browser=opaque');
    const body = await response.json();
    expect(body).toEqual({
      schemaVersion: 1, rulesetVersion: 'points-v4',
      completed: result.completed, atBats: result.atBats,
    });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Cookie');
    expect(response.headers.get('set-cookie')).toBeNull();
    const serialized = JSON.stringify(body);
    for (const secret of ['PRIVATE_UUID', 'SECRET_CANONICAL_PLAYER',
      'SECRET_SIGNED_TOKEN', 'PRIVATE_PLAYER_NAME']) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('blocks foreign-origin requests and all browser-selected comparison arguments', async () => {
    expect((await send(URL, { origin: 'https://attacker.test' })).status).toBe(403);
    expect((await send(URL, { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect((await send(URL + '?excludeResultId=attacker')).status).toBe(400);
    expect((await send(URL + '?score=36')).status).toBe(400);
    expect(read).not.toHaveBeenCalled();
  });

  it('accepts ordinary Origin-less and same-origin GET requests', async () => {
    expect((await send()).status).toBe(200);
    expect((await send(URL, { origin: 'https://example.test', 'sec-fetch-site': 'same-origin' })).status).toBe(200);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['not_found', 404, 'not_found'],
    ['incomplete', 409, 'attempt_incomplete'],
    ['ineligible', 403, 'forbidden'],
    ['not_admitted', 403, 'forbidden'],
  ] as const)('maps %s to a sanitized no-store %i response', async (kind, status, message) => {
    read.mockResolvedValueOnce({ kind });
    const response = await send();
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: message });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('returns one generic error when the private ledger, SQL, signing or provider fails', async () => {
    read.mockRejectedValueOnce(new Error('SECRET_SQL_TOKEN_PLAYER'));
    const response = await send();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'comparison_unavailable' });
    expect(JSON.stringify({ error: 'comparison_unavailable' })).not.toContain('SECRET_SQL_TOKEN_PLAYER');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
