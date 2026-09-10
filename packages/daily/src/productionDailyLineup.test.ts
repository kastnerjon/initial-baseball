import { dailyEligiblePlayers } from '@initial-baseball/baseball-data';
import { describe, expect, it } from 'vitest';
import {
  DAILY_RECOGNIZABILITY_POLICY,
  rankPlayersByRecognizability,
  selectCanonicalDailyPlayersForDate,
} from './index';
import {
  DAILY_DENSE_CANONICAL_RANKING_LAUNCH_DATE,
  DAILY_LINEUP_QUALITY_LAUNCH_DATE,
  createProductionCanonicalDailySelector,
} from './productionDailyLineup';

const resolveCanonicalPlayerId = (playerId: string): string => `canonical:${playerId}`;
const selectLaunchPlayers = createProductionCanonicalDailySelector({}, resolveCanonicalPlayerId);

describe('production canonical Daily lineup', () => {
  it('preserves published legacy lineups before the quality launch date', () => {
    const date = '2026-05-02';
    const selectProductionPlayers = createProductionCanonicalDailySelector({}, resolveCanonicalPlayerId);

    expect(selectProductionPlayers(date)).toEqual(
      selectCanonicalDailyPlayersForDate(date, {}, resolveCanonicalPlayerId),
    );
  });

  it('caches deterministic canonical launch selections with nine unique players', () => {
    const first = selectLaunchPlayers(DAILY_LINEUP_QUALITY_LAUNCH_DATE);
    const second = selectLaunchPlayers(DAILY_LINEUP_QUALITY_LAUNCH_DATE);

    expect(second).toBe(first);
    expect(first).toHaveLength(9);
    expect(new Set(first.map(selection => selection.canonicalPlayerId)).size).toBe(9);
    expect(first.every(selection => selection.canonicalPlayerId.startsWith('canonical:'))).toBe(true);
  });

  it('preserves pre-cutover v2 source-rank semantics', () => {
    const ranked = rankPlayersByRecognizability(dailyEligiblePlayers);
    const sourceRankById = new Map(ranked.map((player, index) => [player.id, index + 1]));
    const canonicalById = new Map(ranked.map((player, index) => [
      player.id,
      index === 1 ? `canonical:${ranked[0]?.id ?? player.id}` : `canonical:${player.id}`,
    ]));
    const selectPlayers = createProductionCanonicalDailySelector(
      {},
      playerId => canonicalById.get(playerId) ?? null,
    );
    const selections = selectPlayers('2026-09-01');

    selections.forEach((selection, index) => {
      const policy = DAILY_RECOGNIZABILITY_POLICY[index];
      const sourceRank = sourceRankById.get(selection.player.id);
      if (policy === undefined || sourceRank === undefined) {
        throw new Error(`Missing source-rank policy for slot ${index + 1}.`);
      }
      expect(sourceRank).toBeGreaterThanOrEqual(policy.minimumRank);
      expect(sourceRank).toBeLessThanOrEqual(policy.maximumRank);
    });
  }, 10_000);

  it('uses dense canonical ranks beginning September 2', () => {
    const ranked = rankPlayersByRecognizability(dailyEligiblePlayers);
    const canonicalById = new Map<string, string>();
    const canonicalOrder = new Map<string, number>();
    let denseRank = 0;
    ranked.forEach((player, index) => {
      const canonicalPlayerId = index === 1
        ? `canonical:${ranked[0]?.id ?? player.id}`
        : `canonical:${player.id}`;
      canonicalById.set(player.id, canonicalPlayerId);
      if (!canonicalOrder.has(canonicalPlayerId)) {
        denseRank += 1;
        canonicalOrder.set(canonicalPlayerId, denseRank);
      }
    });
    const selectPlayers = createProductionCanonicalDailySelector(
      {},
      playerId => canonicalById.get(playerId) ?? null,
    );
    const selections = selectPlayers(DAILY_DENSE_CANONICAL_RANKING_LAUNCH_DATE);

    selections.forEach((selection, index) => {
      const policy = DAILY_RECOGNIZABILITY_POLICY[index];
      const rank = canonicalOrder.get(selection.canonicalPlayerId);
      if (policy === undefined || rank === undefined) {
        throw new Error(`Missing dense canonical rank policy for slot ${index + 1}.`);
      }
      expect(rank).toBeGreaterThanOrEqual(policy.minimumRank);
      expect(rank).toBeLessThanOrEqual(policy.maximumRank);
    });
  });

  it('generates continuously from the dense-ranking cutover through October 2027', () => {
    const selectPlayers = createProductionCanonicalDailySelector({}, resolveCanonicalPlayerId);
    const cursor = new Date(`${DAILY_DENSE_CANONICAL_RANKING_LAUNCH_DATE}T00:00:00.000Z`);
    const end = new Date('2027-10-31T00:00:00.000Z');

    while (cursor.getTime() <= end.getTime()) {
      const date = cursor.toISOString().slice(0, 10);
      const selections = selectPlayers(date);
      expect(selections).toHaveLength(9);
      expect(new Set(selections.map(selection => selection.canonicalPlayerId)).size).toBe(9);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }, 30_000);

  it('uses the approved non-overlapping recognizability bands in production', () => {
    const selections = selectLaunchPlayers(DAILY_LINEUP_QUALITY_LAUNCH_DATE);
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
    const launch = selectLaunchPlayers(DAILY_LINEUP_QUALITY_LAUNCH_DATE);
    const following = selectLaunchPlayers('2026-07-23');
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
