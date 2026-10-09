import { DAILY_AT_BAT_COUNT } from './dailyConstants';

export const CUSTOM_NINE_LINEUP_SCHEMA_VERSION = 1 as const;

export type CustomNineLineupSelection = {
  readonly schemaVersion: typeof CUSTOM_NINE_LINEUP_SCHEMA_VERSION;
  /** Ordered canonical identities, not display-name guesses or source IDs. */
  readonly canonicalPlayerIds: readonly string[];
};

/**
 * Validates a creator's exact ordered nine-player selection without
 * applying Standard Daily's automatic recognizability restrictions.
 *
 * This is syntactic validation only: the server must resolve every ID
 * against the canonical player dataset before issuing a challenge.
 * A playable challenge must also freeze its clues and become immutable.
 */
export function createCustomNineLineupSelection(
  canonicalPlayerIds: readonly string[],
): CustomNineLineupSelection {
  if (!Array.isArray(canonicalPlayerIds) || canonicalPlayerIds.length !== DAILY_AT_BAT_COUNT) {
    throw new Error('Custom Nine requires exactly nine players.');
  }

  const unique = new Set<string>();
  for (const playerId of canonicalPlayerIds) {
    if (typeof playerId !== 'string' || playerId.length === 0
      || playerId.trim() !== playerId || playerId.length > 200) {
      throw new Error('Custom Nine requires valid canonical player IDs.');
    }
    if (unique.has(playerId)) {
      throw new Error('Custom Nine cannot include the same player more than once.');
    }
    unique.add(playerId);
  }

  return Object.freeze({
    schemaVersion: CUSTOM_NINE_LINEUP_SCHEMA_VERSION,
    canonicalPlayerIds: Object.freeze([...canonicalPlayerIds]),
  });
}
