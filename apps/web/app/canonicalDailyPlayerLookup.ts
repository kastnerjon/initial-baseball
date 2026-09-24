import 'server-only';
import { baseballPlayers, dailyEligiblePlayers } from '@initial-baseball/baseball-data';
import {
  createCanonicalDailyEditorialCandidates,
  createCanonicalDailyLineupCandidates,
  rankPlayersByRecognizability,
} from '@initial-baseball/daily';
import type { Player } from '@initial-baseball/shared';
import { resolveCanonicalPlayerId } from './serverCanonicalData';

let cachedPlayersByCanonicalId: ReadonlyMap<string, Player> | null = null;

/**
 * Current gameplay-ready Player records keyed by canonical identity.
 *
 * This is the same candidate universe used by the public editorial Daily path:
 * automatic Daily players plus reveal-ready manual editorial players.
 */
export function getCanonicalDailyPlayer(
  canonicalPlayerId: string,
): Player | null {
  cachedPlayersByCanonicalId ??= buildPlayersByCanonicalId();
  return cachedPlayersByCanonicalId.get(canonicalPlayerId) ?? null;
}

function buildPlayersByCanonicalId(): ReadonlyMap<string, Player> {
  const automaticCandidates = createCanonicalDailyLineupCandidates(
    rankPlayersByRecognizability(dailyEligiblePlayers),
    resolveCanonicalPlayerId,
  );

  return new Map(
    createCanonicalDailyEditorialCandidates(
      automaticCandidates,
      baseballPlayers,
      resolveCanonicalPlayerId,
    ).map(candidate => [candidate.canonicalPlayerId, candidate.player]),
  );
}
