import type { Player } from '@initial-baseball/shared';
import type { DailyLineupCandidate } from './dailyLineupQuality';
import type { ResolveCanonicalPlayerId } from './dailyPuzzleSelection';

export function createCanonicalDailyLineupCandidates(
  rankedPlayers: readonly Player[],
  resolveCanonicalPlayerId: ResolveCanonicalPlayerId,
): DailyLineupCandidate[] {
  return createCanonicalCandidates(rankedPlayers, resolveCanonicalPlayerId, 'dense-canonical');
}

export function createCanonicalDailyEditorialCandidates(
  automaticCandidates: readonly DailyLineupCandidate[],
  editorialPlayers: readonly Player[],
  resolveCanonicalPlayerId: ResolveCanonicalPlayerId,
): DailyLineupCandidate[] {
  const automaticByCanonicalId = new Map(
    automaticCandidates.map(candidate => [candidate.canonicalPlayerId, candidate]),
  );

  return createCanonicalCandidates(editorialPlayers, resolveCanonicalPlayerId, 'dense-canonical')
    .flatMap((candidate) => {
      const automaticCandidate = automaticByCanonicalId.get(candidate.canonicalPlayerId);
      if (automaticCandidate !== undefined) return [automaticCandidate];
      if (!candidate.revealReady) return [];

      return [{
        ...candidate,
        recognizabilityRank: null,
      }];
    });
}

export function createLegacySourceRankCanonicalDailyLineupCandidates(
  rankedPlayers: readonly Player[],
  resolveCanonicalPlayerId: ResolveCanonicalPlayerId,
): DailyLineupCandidate[] {
  return createCanonicalCandidates(rankedPlayers, resolveCanonicalPlayerId, 'source-rank');
}

function createCanonicalCandidates(
  rankedPlayers: readonly Player[],
  resolveCanonicalPlayerId: ResolveCanonicalPlayerId,
  rankMode: 'dense-canonical' | 'source-rank',
): DailyLineupCandidate[] {
  const candidatesByCanonicalId = new Map<string, DailyLineupCandidate>();

  rankedPlayers.forEach((player, sourceIndex) => {
    const canonicalPlayerId = resolveCanonicalPlayerId(player.id);
    if (canonicalPlayerId === null || candidatesByCanonicalId.has(canonicalPlayerId)) return;

    const canonicalRank = candidatesByCanonicalId.size + 1;
    candidatesByCanonicalId.set(canonicalPlayerId, {
      canonicalPlayerId,
      player,
      recognizabilityRank: rankMode === 'dense-canonical' ? canonicalRank : sourceIndex + 1,
      revealReady: isRevealReady(player),
    });
  });

  return [...candidatesByCanonicalId.values()];
}

function isRevealReady(player: Player): boolean {
  return player.displayName.trim().length > 0
    && player.primaryPosition.trim().length > 0
    && player.firstYear !== null
    && player.lastYear !== null
    && player.careerStats !== null;
}
