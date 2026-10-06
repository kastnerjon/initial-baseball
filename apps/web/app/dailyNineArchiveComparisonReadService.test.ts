import type { DailyNineComparisonService } from '@initial-baseball/daily';
import type { DailyPublicPuzzle } from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import { createDailyNineComparisonReadService } from './dailyNineComparisonReadService';

const ARCHIVE: DailyPublicPuzzle = {
  id: 'archive-beta-v1-daily-1', puzzleDate: '2026-10-04', puzzleNumber: 1,
  status: 'published', hintConfig: [], statsHintConfig: { hitter: [], pitcher: [] },
  pitches: Array.from({ length: 9 }, (_, index) => ({ pitchNumber: index + 1, initials: 'AB' })),
};
const DAILY = { ...ARCHIVE, id: 'daily-2026-10-04-editorial-a9429f70', puzzleNumber: 161 };
const REQUEST = { puzzleId: ARCHIVE.id, puzzleDate: ARCHIVE.puzzleDate, rulesetVersion: 'points-v4' };

function setup() {
  const comparison: DailyNineComparisonService = {
    getAtBat: vi.fn(async key => ({ ...key, resolvedAtBatCount: 0, averagePoints: null })),
    getCompletedGames: vi.fn(async key => ({
      ...key, completedGameCount: 0, averageTotalPoints: null, scoreHistogram: Array(73).fill(0),
    })),
  };
  const loadAuthoritativePuzzle = vi.fn(async (_date: string, id?: string) =>
    id?.startsWith('archive-beta-v1-daily-') ? ARCHIVE : DAILY);
  const service = createDailyNineComparisonReadService({
    comparison, loadAuthoritativePuzzle, getCurrentDailyDate: () => '2026-10-06',
  });
  return { service, comparison, loadAuthoritativePuzzle };
}

describe('archive comparison authoritative routing', () => {
  it('keeps same-date archive and current Daily populations separate on both reads', async () => {
    const { service, comparison } = setup();
    for (const puzzleId of [ARCHIVE.id, DAILY.id, null]) {
      const request = { ...REQUEST, puzzleId };
      const puzzle = puzzleId === ARCHIVE.id ? ARCHIVE : DAILY;
      const key = {
        puzzleId: puzzle.id, puzzleDate: puzzle.puzzleDate, puzzleNumber: puzzle.puzzleNumber,
        rulesetVersion: 'points-v4',
      };
      const atBat = await service.readAtBat({ ...request, pitchNumber: '2' });
      const completed = await service.readCompleted(request);
      expect(comparison.getAtBat).toHaveBeenLastCalledWith({ ...key, pitchNumber: 2 });
      expect(comparison.getCompletedGames).toHaveBeenLastCalledWith(key);
      expect(atBat.comparison).toMatchObject({ ...key, averagePoints: null });
      expect(completed.comparison).toMatchObject({ ...key, averageTotalPoints: null });
    }
  });

  it.each([
    [{ ...REQUEST, puzzleId: '' }, 'invalid_request'],
    [{ ...REQUEST, puzzleId: ' ' }, 'invalid_request'],
    [{ ...REQUEST, puzzleId: 'x'.repeat(201) }, 'invalid_request'],
    [{ ...REQUEST, rulesetVersion: 'points-v3' }, 'unsupported_ruleset'],
    [{ ...REQUEST, rulesetVersion: 'classic-inning-v1' }, 'unsupported_ruleset'],
    [{ ...REQUEST, puzzleDate: '2026-10-07' }, 'invalid_puzzle'],
  ])('rejects invalid archive routing before loading/provider access', async (request, code) => {
    const { service, comparison, loadAuthoritativePuzzle } = setup();
    await expect(service.readAtBat({ ...request, pitchNumber: '1' })).rejects.toMatchObject({ code });
    await expect(service.readCompleted(request)).rejects.toMatchObject({ code });
    expect(loadAuthoritativePuzzle).not.toHaveBeenCalled();
    expect(comparison.getAtBat).not.toHaveBeenCalled();
    expect(comparison.getCompletedGames).not.toHaveBeenCalled();
  });

  it.each([
    { ...REQUEST, puzzleId: 'archive-beta-v1-daily-2' },
    { ...REQUEST, puzzleId: 'archive-beta-v1-daily-01' },
    { ...REQUEST, puzzleId: 'permanent-v1-daily-1' },
    { ...REQUEST, puzzleId: 'forged' },
    { ...REQUEST, puzzleDate: '2026-10-05' },
  ])('rejects authoritative ID/date mismatches before provider access', async request => {
    const { service, comparison } = setup();
    await expect(service.readAtBat({ ...request, pitchNumber: '1' }))
      .rejects.toMatchObject({ code: 'invalid_puzzle' });
    await expect(service.readCompleted(request)).rejects.toMatchObject({ code: 'invalid_puzzle' });
    expect(comparison.getAtBat).not.toHaveBeenCalled();
    expect(comparison.getCompletedGames).not.toHaveBeenCalled();
  });

  it('propagates an unissued puzzle failure without touching aggregates', async () => {
    const { service, comparison, loadAuthoritativePuzzle } = setup();
    const failure = new Error('unissued');
    loadAuthoritativePuzzle.mockRejectedValue(failure);
    await expect(service.readCompleted(REQUEST)).rejects.toBe(failure);
    expect(comparison.getCompletedGames).not.toHaveBeenCalled();
  });
});
