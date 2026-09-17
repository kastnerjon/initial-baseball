import { dailyEligiblePlayers } from '@initial-baseball/baseball-data';
import { describe, expect, it } from 'vitest';
import {
  createCanonicalDailyEditorialCandidates,
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

  it('adds reveal-ready editorial players without giving them an automatic rank', () => {
    const templates = dailyEligiblePlayers.filter(player => player.careerStats !== null).slice(0, 2);
    const [automaticPlayer, editorialTemplate] = templates;
    if (automaticPlayer === undefined || editorialTemplate === undefined) {
      throw new Error('Expected reveal-ready Daily players.');
    }

    const editorialOnlyPlayer = {
      ...editorialTemplate,
      id: 'legacy:editorial-only',
      displayName: 'Editorial Only Player',
      fullName: 'Editorial Only Player',
    };
    const canonicalIds = new Map([
      [automaticPlayer.id, 'canonical:auto'],
      [editorialOnlyPlayer.id, 'canonical:editorial'],
    ]);
    const resolveCanonicalPlayerId = (playerId: string): string | null => canonicalIds.get(playerId) ?? null;
    const automaticCandidates = createCanonicalDailyLineupCandidates(
      [automaticPlayer],
      resolveCanonicalPlayerId,
    );

    const candidates = createCanonicalDailyEditorialCandidates(
      automaticCandidates,
      [automaticPlayer, editorialOnlyPlayer],
      resolveCanonicalPlayerId,
    );

    expect(candidates).toEqual([
      expect.objectContaining({ canonicalPlayerId: 'canonical:auto', recognizabilityRank: 1 }),
      expect.objectContaining({
        canonicalPlayerId: 'canonical:editorial',
        recognizabilityRank: null,
        revealReady: true,
      }),
    ]);
  });

  it('does not expose non-reveal-ready players to manual editorial selection', () => {
    const template = dailyEligiblePlayers.find(player => player.careerStats !== null);
    if (template === undefined) throw new Error('Expected a reveal-ready Daily player.');

    const unavailablePlayer = {
      ...template,
      id: 'legacy:unavailable',
      displayName: 'Unavailable Player',
      fullName: 'Unavailable Player',
      careerStats: null,
    };
    const resolveCanonicalPlayerId = (playerId: string): string | null => (
      playerId === unavailablePlayer.id ? 'canonical:unavailable' : null
    );

    expect(createCanonicalDailyEditorialCandidates(
      [],
      [unavailablePlayer],
      resolveCanonicalPlayerId,
    )).toEqual([]);
  });
});