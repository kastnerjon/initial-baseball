import { baseballPlayers, dailyEligiblePlayers } from '@initial-baseball/baseball-data';
import { validateDailyAtBatResult } from '@initial-baseball/engine';
import {
  DAILY_AT_BAT_RESULT_SCHEMA_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';
import {
  archiveDailyPuzzle,
  createDailyPuzzleDraft,
  createEditorialDailyPuzzleId,
  getDailyPuzzleNumber,
  publishDailyPuzzle,
  scheduleDailyPuzzle,
  type DailyPuzzleEditorialRecord,
} from '@initial-baseball/daily';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./serverCanonicalData', () => ({
  resolveCanonicalPlayerId: (id: string) => id === 'unmapped' ? null : `canonical:${id}`,
}));
vi.mock('@initial-baseball/baseball-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@initial-baseball/baseball-data')>();
  const template = actual.dailyEligiblePlayers.find(player => player.careerStats !== null)!;
  const automatic = Array.from({ length: 9 }, (_, index) => ({
    ...template, id: `automatic-${index}`, fullName: `Automatic Player ${index}`,
    displayName: `Automatic Player ${index}`,
  }));
  const manual = {
    ...template, id: 'manual-only', fullName: 'Manual Player', displayName: 'Manual Player',
    dailyEligible: false, dailyEligibilityTier: 'none' as const,
  };
  const suffix = {
    ...manual, id: 'suffix', fullName: 'Ken Griffey Jr.', displayName: 'Ken Griffey Jr.',
  };
  return {
    ...actual,
    dailyEligiblePlayers: automatic,
    baseballPlayers: [
      ...automatic, manual, suffix,
      { ...manual, id: 'unavailable', careerStats: null },
      { ...manual, id: 'unmapped' },
    ],
  };
});

import { createPublicDailyPuzzleSource } from './publicDailyPuzzleSource';

const date = '2026-07-24';
const actor = { actorId: 'test-editor', occurredAt: '2026-07-23T12:00:00.000Z' };
const ids = ['canonical:manual-only', ...dailyEligiblePlayers.slice(0, 8).map(p => `canonical:${p.id}`)];
const draft = createDailyPuzzleDraft({
  id: `daily-${date}-v1`, puzzleDate: date, puzzleNumber: 89,
  selections: ids.map((canonicalPlayerId, index) => ({ slot: index + 1, canonicalPlayerId, source: 'manual' })),
  ...actor,
});
const scheduled = scheduleDailyPuzzle(draft, actor);
const published = publishDailyPuzzle(scheduled, actor);

function buildSource(record: DailyPuzzleEditorialRecord | null, withoutRepository = false) {
  const selectDeterministicPlayers = vi.fn(() => dailyEligiblePlayers.map(player => ({
    player, canonicalPlayerId: `canonical:${player.id}`,
  })));
  return {
    selectDeterministicPlayers,
    source: createPublicDailyPuzzleSource({
      repository: withoutRepository ? null : { getByDate: async () => record },
      selectDeterministicPlayers,
    }),
  };
}

describe('public Daily puzzle source editorial candidates', () => {
  it.each([scheduled, published])('loads exact ordered manual selections for $status', async (record) => {
    const { source, selectDeterministicPlayers } = buildSource(record);
    const puzzle = await source(date);
    expect(puzzle.id).toBe(createEditorialDailyPuzzleId(date, ids));
    expect(puzzle.puzzleNumber).toBe(89);
    expect(puzzle.status).toBe(record.status);
    expect(puzzle.pitches.map(p => p.player.playerId)).toEqual(ids);
    expect(puzzle.pitches.map(p => p.pitchNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(puzzle.pitches[0]?.player.displayName).toBe('Manual Player');
    expect(Object.keys(puzzle.pitches[0]!.hints).sort()).toEqual(['main_decade', 'position', 'stats', 'teams']);
    expect(selectDeterministicPlayers).not.toHaveBeenCalled();
    expect(dailyEligiblePlayers.some(p => p.id === 'manual-only')).toBe(false);
    expect(baseballPlayers.some(p => p.id === 'manual-only')).toBe(true);
  });

  it.each(['unavailable', 'unmapped', 'unknown'])('rejects %s instead of substituting an answer', async (id) => {
    const record = { ...scheduled, selections: scheduled.selections.map((s, index) => (
      index === 0 ? { ...s, canonicalPlayerId: `canonical:${id}` } : s
    )) };
    const { source, selectDeterministicPlayers } = buildSource(record);
    await expect(source(date)).rejects.toThrow('references unavailable canonical player');
    expect(selectDeterministicPlayers).not.toHaveBeenCalled();
  });

  it.each([null, draft])('retains deterministic fallback for absent/draft records', async (record) => {
    const { source, selectDeterministicPlayers } = buildSource(record);
    const puzzle = await source(date);
    expect(selectDeterministicPlayers).toHaveBeenCalledWith(date);
    expect(puzzle.pitches.map(p => p.player.playerId)).toEqual(dailyEligiblePlayers.map(p => `canonical:${p.id}`));
  });

  it('retains fallback without a configured repository', async () => {
    const { source, selectDeterministicPlayers } = buildSource(null, true);
    await source(date);
    expect(selectDeterministicPlayers).toHaveBeenCalledWith(date);
  });

  it('does not replace archived answers with generated players', async () => {
    const { source, selectDeterministicPlayers } = buildSource(archiveDailyPuzzle(published, actor));
    await expect(source(date)).rejects.toThrow('archived');
    expect(selectDeterministicPlayers).not.toHaveBeenCalled();
  });

  it.each([
    ['2026-09-27', 'KGJ'],
    ['2026-09-28', 'KG'],
  ])('keeps editorial and fallback initials for %s in their own date version', async (puzzleDate, initials) => {
    const selectedIds = ['canonical:suffix', ...ids.slice(1)];
    const draftForDate = createDailyPuzzleDraft({
      id: `daily-${puzzleDate}-v1`, puzzleDate, puzzleNumber: getDailyPuzzleNumber(puzzleDate),
      selections: selectedIds.map((canonicalPlayerId, index) => ({
        slot: index + 1, canonicalPlayerId, source: 'manual',
      })),
      ...actor,
    });
    const editorial = createPublicDailyPuzzleSource({
      repository: { getByDate: async () => scheduleDailyPuzzle(draftForDate, actor) },
      selectDeterministicPlayers: () => { throw new Error('Unexpected fallback'); },
    });
    const fallback = createPublicDailyPuzzleSource({
      repository: null,
      selectDeterministicPlayers: () => [
        { player: baseballPlayers.find(p => p.id === 'suffix')!, canonicalPlayerId: 'canonical:suffix' },
        ...dailyEligiblePlayers.slice(0, 8).map(player => ({
          player, canonicalPlayerId: `canonical:${player.id}`,
        })),
      ],
    });

    const persistedPuzzle = await editorial(puzzleDate);
    expect(persistedPuzzle.pitches[0]?.player.initials).toBe(initials);
    expect((await fallback(puzzleDate)).pitches[0]?.player.initials).toBe(initials);
    if (puzzleDate === '2026-09-27') {
      expect(validateDailyAtBatResult({
        puzzle: {
          ...persistedPuzzle,
          pitches: persistedPuzzle.pitches.map(pitch => ({
            pitchNumber: pitch.pitchNumber, initials: pitch.player.initials,
          })),
        },
        rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
        submission: {
          schemaVersion: DAILY_AT_BAT_RESULT_SCHEMA_VERSION,
          attemptId: 'historical-suffix-result',
          puzzleId: persistedPuzzle.id,
          puzzleDate: persistedPuzzle.puzzleDate,
          puzzleNumber: persistedPuzzle.puzzleNumber,
          rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
          atBat: {
            pitchNumber: 1, initials: 'KGJ', outcome: 'K',
            hintsRevealed: 0, wrongGuesses: 0, resolution: 'give_up',
          },
        },
      }).ok).toBe(true);
    }
  });
});
