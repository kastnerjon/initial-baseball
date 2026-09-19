import { POINTS_V3_DAILY_RULESET_VERSION, type DailyPublicPuzzle } from '@initial-baseball/shared';
import type { DailyNineComparisonService } from '@initial-baseball/daily';
import { describe, expect, it, vi } from 'vitest';
import {
  DailyNineComparisonRequestError,
  createDailyNineComparisonReadService,
} from './dailyNineComparisonReadService';

const PUZZLE: DailyPublicPuzzle = {
  id: 'daily-2026-09-19-editorial-a9429f70',
  puzzleDate: '2026-09-19',
  puzzleNumber: 146,
  status: 'scheduled',
  hintConfig: [],
  statsHintConfig: { hitter: [], pitcher: [] },
  pitches: Array.from({ length: 9 }, (_, index) => ({
    pitchNumber: index + 1,
    initials: `P${index + 1}`,
  })),
};

describe('Daily Nine comparison read service', () => {
  it('derives exact at-bat population identity from the authoritative puzzle', async () => {
    const comparison = comparisonService();
    comparison.getAtBat = vi.fn().mockResolvedValue({
      puzzleId: PUZZLE.id,
      puzzleDate: PUZZLE.puzzleDate,
      puzzleNumber: PUZZLE.puzzleNumber,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      pitchNumber: 4,
      resolvedAtBatCount: 3,
      averagePoints: 5,
    });
    const loadAuthoritativePuzzle = vi.fn().mockResolvedValue(PUZZLE);
    const service = createService({ comparison, loadAuthoritativePuzzle });

    await expect(service.readAtBat({
      puzzleDate: '2026-09-19',
      rulesetVersion: 'points-v3',
      pitchNumber: '4',
    })).resolves.toEqual({
      schemaVersion: 1,
      kind: 'at-bat',
      comparison: {
        puzzleId: PUZZLE.id,
        puzzleDate: PUZZLE.puzzleDate,
        puzzleNumber: PUZZLE.puzzleNumber,
        rulesetVersion: 'points-v3',
        pitchNumber: 4,
        resolvedAtBatCount: 3,
        averagePoints: 5,
      },
      freshness: {
        sourceReadAt: '2026-09-19T23:30:00.000Z',
        cacheStatus: 'live',
      },
    });

    expect(loadAuthoritativePuzzle).toHaveBeenCalledWith('2026-09-19');
    expect(comparison.getAtBat).toHaveBeenCalledWith({
      puzzleId: PUZZLE.id,
      puzzleDate: PUZZLE.puzzleDate,
      puzzleNumber: PUZZLE.puzzleNumber,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      pitchNumber: 4,
    });
    expect(comparison.getCompletedGames).not.toHaveBeenCalled();
  });

  it('keeps completed reads independent and user-independent', async () => {
    const comparison = comparisonService();
    comparison.getCompletedGames = vi.fn().mockResolvedValue({
      puzzleId: PUZZLE.id,
      puzzleDate: PUZZLE.puzzleDate,
      puzzleNumber: PUZZLE.puzzleNumber,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      completedGameCount: 2,
      averageTotalPoints: 34.5,
      scoreHistogram: Array.from({ length: 64 }, (_, points) =>
        points === 31 || points === 38 ? 1 : 0),
    });
    const service = createService({ comparison });

    const result = await service.readCompleted({
      puzzleDate: '2026-09-19',
      rulesetVersion: 'points-v3',
    });

    expect(result.kind).toBe('completed');
    expect(result.comparison.completedGameCount).toBe(2);
    expect(result.comparison.scoreHistogram[31]).toBe(1);
    expect(result.freshness).toEqual({
      sourceReadAt: '2026-09-19T23:30:00.000Z',
      cacheStatus: 'live',
    });
    expect(comparison.getAtBat).not.toHaveBeenCalled();
  });

  it.each([
    [{ puzzleDate: null, rulesetVersion: 'points-v3', pitchNumber: '1' }, 'invalid_request'],
    [{ puzzleDate: '2026-02-30', rulesetVersion: 'points-v3', pitchNumber: '1' }, 'invalid_request'],
    [{ puzzleDate: '2026-09-19', rulesetVersion: null, pitchNumber: '1' }, 'invalid_request'],
    [{ puzzleDate: '2026-09-19', rulesetVersion: 'classic-inning-v1', pitchNumber: '1' }, 'unsupported_ruleset'],
    [{ puzzleDate: '2026-09-19', rulesetVersion: 'points-v3', pitchNumber: null }, 'invalid_request'],
    [{ puzzleDate: '2026-09-19', rulesetVersion: 'points-v3', pitchNumber: '0' }, 'invalid_request'],
    [{ puzzleDate: '2026-09-19', rulesetVersion: 'points-v3', pitchNumber: '10' }, 'invalid_request'],
  ])('rejects invalid at-bat routing before provider reads', async (request, code) => {
    const comparison = comparisonService();
    const loadAuthoritativePuzzle = vi.fn().mockResolvedValue(PUZZLE);
    const service = createService({ comparison, loadAuthoritativePuzzle });

    await expect(service.readAtBat(request)).rejects.toMatchObject({
      name: 'DailyNineComparisonRequestError',
      code,
    });
    expect(loadAuthoritativePuzzle).not.toHaveBeenCalled();
    expect(comparison.getAtBat).not.toHaveBeenCalled();
  });

  it('rejects future Daily dates before loading a puzzle', async () => {
    const loadAuthoritativePuzzle = vi.fn().mockResolvedValue(PUZZLE);
    const service = createService({ loadAuthoritativePuzzle });

    await expect(service.readCompleted({
      puzzleDate: '2026-09-20',
      rulesetVersion: 'points-v3',
    })).rejects.toMatchObject({
      code: 'invalid_puzzle',
    });
    expect(loadAuthoritativePuzzle).not.toHaveBeenCalled();
  });

  it('fails closed when authoritative puzzle metadata disagrees with requested date', async () => {
    const service = createService({
      loadAuthoritativePuzzle: vi.fn().mockResolvedValue({
        ...PUZZLE,
        puzzleDate: '2026-09-18',
      }),
    });

    await expect(service.readCompleted({
      puzzleDate: '2026-09-19',
      rulesetVersion: 'points-v3',
    })).rejects.toBeInstanceOf(DailyNineComparisonRequestError);
  });

  it('stamps sourceReadAt only after a successful comparison read', async () => {
    const order: string[] = [];
    const comparison = comparisonService();
    comparison.getAtBat = vi.fn().mockImplementation(async () => {
      order.push('read');
      return {
        puzzleId: PUZZLE.id,
        puzzleDate: PUZZLE.puzzleDate,
        puzzleNumber: PUZZLE.puzzleNumber,
        rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
        pitchNumber: 1,
        resolvedAtBatCount: 0,
        averagePoints: null,
      };
    });
    const service = createDailyNineComparisonReadService({
      comparison,
      loadAuthoritativePuzzle: async () => PUZZLE,
      getCurrentDailyDate: () => '2026-09-19',
      now: () => {
        order.push('clock');
        return new Date('2026-09-19T23:30:00.000Z');
      },
    });

    await service.readAtBat({
      puzzleDate: '2026-09-19',
      rulesetVersion: 'points-v3',
      pitchNumber: '1',
    });

    expect(order).toEqual(['read', 'clock']);
  });

  it('does not turn provider failures into request errors', async () => {
    const comparison = comparisonService();
    const providerFailure = new Error('provider unavailable');
    comparison.getCompletedGames = vi.fn().mockRejectedValue(providerFailure);
    const service = createService({ comparison });

    await expect(service.readCompleted({
      puzzleDate: '2026-09-19',
      rulesetVersion: 'points-v3',
    })).rejects.toBe(providerFailure);
  });
});

function createService(overrides: {
  comparison?: DailyNineComparisonService;
  loadAuthoritativePuzzle?: (date: string) => Promise<DailyPublicPuzzle>;
} = {}) {
  return createDailyNineComparisonReadService({
    comparison: overrides.comparison ?? comparisonService(),
    loadAuthoritativePuzzle: overrides.loadAuthoritativePuzzle ?? (async () => PUZZLE),
    getCurrentDailyDate: () => '2026-09-19',
    now: () => new Date('2026-09-19T23:30:00.000Z'),
  });
}

function comparisonService(): DailyNineComparisonService {
  return {
    getAtBat: vi.fn(),
    getCompletedGames: vi.fn(),
  };
}
