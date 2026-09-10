import { dailyEligiblePlayers } from '@initial-baseball/baseball-data';
import { describe, expect, it } from 'vitest';
import {
  createCanonicalDailyLineupCandidates,
  createLegacySourceRankCanonicalDailyLineupCandidates,
} from './dailyLineupCandidates';
import { rankPlayersByRecognizability } from './dailyPuzzleSelection';

describe('canonical Daily lineup candidates', () => {
  it('assigns dense recognizability ranks after canonical deduplication', () => {
    const rankedPlayers = rankPlayersByRecognizability(dailyEligiblePlayers).slice(0, 4);
    const [first, second, third, fourth] = rankedPlayers;
    if (first === undefined || second === undefined || third === undefined || fourth === undefined) {
      throw new Error('Expected at least four Daily-eligible players.');
    }

    const canonicalIds = new Map([
      [first.id, 'canonical:shared'],
      [second.id, 'canonical:shared'],
      [third.id, 'canonical:third'],
      [fourth.id, 'canonical:fourth'],
    ]);
    const resolveCanonicalPlayerId = (playerId: string): string | null => canonicalIds.get(playerId) ?? null;

    expect(
      createCanonicalDailyLineupCandidates(rankedPlayers, resolveCanonicalPlayerId)
        .map(candidate => candidate.recognizabilityRank),
    ).toEqual([1, 2, 3]);
  });

  it('retains source ranks only through the explicit compatibility factory', () => {
    const rankedPlayers = rankPlayersByRecognizability(dailyEligiblePlayers).slice(0, 4);
    const [first, second, third, fourth] = rankedPlayers;
    if (first === undefined || second === undefined || third === undefined || fourth === undefined) {
      throw new Error('Expected at least four Daily-eligible players.');
    }

    const canonicalIds = new Map([
      [first.id, 'canonical:shared'],
      [second.id, 'canonical:shared'],
      [third.id, 'canonical:third'],
      [fourth.id, 'canonical:fourth'],
    ]);
    const resolveCanonicalPlayerId = (playerId: string): string | null => canonicalIds.get(playerId) ?? null;

    expect(
      createLegacySourceRankCanonicalDailyLineupCandidates(rankedPlayers, resolveCanonicalPlayerId)
        .map(candidate => candidate.recognizabilityRank),
    ).toEqual([1, 3, 4]);
  });

  it('fills top 250 with 250 canonical candidates when source aliases leave only 173 distinct entries', () => {
    const rankedPlayers = rankPlayersByRecognizability(dailyEligiblePlayers);
    expect(rankedPlayers.length).toBeGreaterThan(326);

    const topCanonicalIds = rankedPlayers.slice(0, 173).map(player => `canonical:${player.id}`);
    const sourceAliases = new Map<string, string>();
    rankedPlayers.slice(0, 250).forEach((player, index) => {
      sourceAliases.set(
        player.id,
        index < 173
          ? topCanonicalIds[index] ?? `canonical:${player.id}`
          : topCanonicalIds[index - 173] ?? `canonical:${player.id}`,
      );
    });
    const resolveCanonicalPlayerId = (playerId: string): string => sourceAliases.get(playerId) ?? `canonical:${playerId}`;

    const sparse = createLegacySourceRankCanonicalDailyLineupCandidates(rankedPlayers, resolveCanonicalPlayerId);
    const dense = createCanonicalDailyLineupCandidates(rankedPlayers, resolveCanonicalPlayerId);

    expect(sparse.filter(candidate => (candidate.recognizabilityRank ?? Infinity) <= 250)).toHaveLength(173);
    expect(dense.filter(candidate => (candidate.recognizabilityRank ?? Infinity) <= 250)).toHaveLength(250);
    expect(new Set(dense.slice(0, 250).map(candidate => candidate.canonicalPlayerId)).size).toBe(250);
  });
});
