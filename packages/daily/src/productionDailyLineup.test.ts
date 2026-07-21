import { dailyEligiblePlayers } from '@initial-baseball/baseball-data';
import { describe, expect, it } from 'vitest';
import {
  DAILY_RECOGNIZABILITY_POLICY,
  rankPlayersByRecognizability,
  selectCanonicalDailyPlayersForDate,
} from './index';
import {
  DAILY_LINEUP_QUALITY_LAUNCH_DATE,
  createProductionCanonicalDailySelector,
} from './productionDailyLineup';

const resolveCanonicalPlayerId = (playerId: string): string => `canonical:${playerId}`;

describe('production canonical Daily lineup', () => {
  it('preserves published legacy lineups before the quality launch date', () => {
    const date = '2026-05-02';
    const selectProductionPlayers = createProductionCanonicalDailySelector({}, resolveCanonicalPlayerId);

    expect(selectProductionPlayers(date)).toEqual(
      selectCanonicalDailyPlayersForDate(date, {}, resolveCanonicalPlayerId),
    );
  });

  it('caches deterministic canonical launch selections with nine unique players', () => {
    const selectPlayers = createProductionCanonicalDailySelector({}, resolveCanonicalPlayerId);
    const first = selectPlayers(DAILY_LINEUP_QUALITY_LAUNCH_DATE);
    const second = selectPlayers(DAILY_LINEUP_QUALITY_LAUNCH_DATE);

    expect(second).toBe(first);
    expect(first).toHaveLength(9);
    expect(new Set(first.map(selection => selection.canonicalPlayerId)).size).toBe(9);
    expect(first.every(selection => selection.canonicalPlayerId.startsWith('canonical:'))).toBe(true);
  });

  it('uses the approved non-overlapping recognizability bands in production', () => {
    const selectPlayers = createProductionCanonicalDailySelector({}, resolveCanonicalPlayerId);
    const selections = selectPlayers(DAILY_LINEUP_QUALITY_LAUNCH_DATE);
    const globalRanks = new Map(
      rankPlayersByRecognizability(dailyEligiblePlayers)
        .map((player, index) => [player.id, index + 1]),
    );

    selections.forEach((selection, index) => {
      const policy = DAILY_RECOGNIZABILITY_POLICY[index];
      const rank = globalRanks.get(selection.player.id);
      if (policy === undefined || rank === undefined) {
        throw new Error(`Missing production rank policy for slot ${index + 1}.`);
      }
      expect(rank).toBeGreaterThanOrEqual(policy.minimumRank);
      expect(rank).toBeLessThanOrEqual(policy.maximumRank);
    });
  });

  it('does not repeat launch players on the following generated date', () => {
    const selectPlayers = createProductionCanonicalDailySelector({}, resolveCanonicalPlayerId);
    const launch = selectPlayers(DAILY_LINEUP_QUALITY_LAUNCH_DATE);
    const following = selectPlayers('2026-07-23');
    const launchIds = new Set(launch.map(selection => selection.canonicalPlayerId));

    expect(following.some(selection => launchIds.has(selection.canonicalPlayerId))).toBe(false);
  });

  it('keeps exact manual override order and canonicalizes every answer', () => {
    const date = '2026-05-02';
    const overrides = {
      [date]: [
        'Ken Griffey Jr.',
        'David Wright',
        'CC Sabathia',
        'Albert Pujols',
        'Derek Jeter',
        'Ichiro Suzuki',
      ],
    } as const;
    const selectPlayers = createProductionCanonicalDailySelector(overrides, resolveCanonicalPlayerId);
    const selections = selectPlayers(date);

    expect(selections.map(selection => selection.player.displayName)).toEqual(overrides[date]);
    expect(selections.every(selection => selection.canonicalPlayerId.startsWith('canonical:'))).toBe(true);
  });
});
