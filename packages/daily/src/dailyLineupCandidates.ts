import type { Player } from '@initial-baseball/shared';
import type { DailyLineupCandidate } from './dailyLineupQuality';
import type { ResolveCanonicalPlayerId } from './dailyPuzzleSelection';

export function createCanonicalDailyLineupCandidates(
  rankedPlayers: readonly Player[],
  resolveCanonicalPlayerId: ResolveCanonicalPlayerId,
): DailyLineupCandidate[] {
  const candidatesByCanonicalId = new Map<string, DailyLineupCandidate>();

  rankedPlayers.forEach((player, index) => {
    const canonicalPlayerId = resolveCanonicalPlayerId(player.id);
    if (canonicalPlayerId === null || candidatesByCanonicalId.has(canonicalPlayerId)) return;

    candidatesByCanonicalId.set(canonicalPlayerId, {
      canonicalPlayerId,
      player,
      recognizabilityRank: index + 1,
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
