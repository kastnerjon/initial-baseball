import { describe, expect, it } from 'vitest';
import {
  DAILY_RECOGNIZABILITY_POLICY,
  rankPlayersByRecognizability,
} from './index';
import { selectProductionCanonicalDailyPlayersForDate } from './productionDailyLineup';

const TEST_DATE = '2026-04-27';
const resolveCanonicalPlayerId = (playerId: string): string => `canonical:${playerId}`;

describe('production canonical Daily lineup', () => {
  it('is deterministic, canonical, unique, and nine players long', () => {
    const first = selectProductionCanonicalDailyPlayersForDate(TEST_DATE, {}, resolveCanonicalPlayerId);
    const second = selectProductionCanonicalDailyPlayersForDate(TEST_DATE, {}, resolveCanonicalPlayerId);

    expect(second).toEqual(first);
    expect(first).toHaveLength(9);
    expect(new Set(first.map(selection => selection.canonicalPlayerId)).size).toBe(9);
    expect(first.every(selection => selection.canonicalPlayerId.startsWith('canonical:'))).toBe(true);
  });

  it('uses the approved recognizability curve in the live selector', () => {
    const selections = selectProductionCanonicalDailyPlayersForDate(TEST_DATE, {}, resolveCanonicalPlayerId);
    const ranks = new Map(
      rankPlayersByRecognizability(selections.map(selection => selection.player))
        .map((player, index) => [player.id, index + 1]),
    );

    selections.forEach((selection, index) => {
      const policy = DAILY_RECOGNIZABILITY_POLICY[index];
      if (policy === undefined) throw new Error(`Missing policy for slot ${index + 1}.`);
      expect(ranks.get(selection.player.id)).toBeDefined();
    });
  });

  it('keeps exact manual override order and canonicalizes every answer', () => {
    const overrides = {
      [TEST_DATE]: [
        'Ken Griffey Jr.',
        'David Wright',
        'CC Sabathia',
        'Albert Pujols',
        'Derek Jeter',
        'Ichiro Suzuki',
      ],
    } as const;
    const selections = selectProductionCanonicalDailyPlayersForDate(
      TEST_DATE,
      overrides,
      resolveCanonicalPlayerId,
    );

    expect(selections.map(selection => selection.player.displayName)).toEqual(overrides[TEST_DATE]);
    expect(selections.every(selection => selection.canonicalPlayerId.startsWith('canonical:'))).toBe(true);
  });
});
