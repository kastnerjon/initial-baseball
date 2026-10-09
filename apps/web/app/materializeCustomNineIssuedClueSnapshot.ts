import 'server-only';
import {
  createCustomNineLineupSelection,
  type PermanentDailyIssuedClueSnapshot,
} from '@initial-baseball/daily';
import { getCanonicalDailyPlayer } from './canonicalDailyPlayerLookup';
import { createDailyPuzzlePitch } from './dailyPuzzleAdapters';
import {
  materializePermanentDailyIssuedClueSnapshot,
  type DailyPitchFactory,
  type IssuedDailyCluePlayerResolver,
} from './materializePermanentDailyIssuedClueSnapshot';

// Existing Daily hint construction uses these explicit fallback strings.
// A manually issued Custom challenge must have supported facts for all four hints.
const UNSUPPORTED_HINT_VALUES = new Set([
  'Unknown',
  'Teams unavailable',
  'Stats unavailable',
]);

/**
 * Server-only Custom Nine lineup materialization. The default resolver accepts
 * gameplay-ready canonical IDs, not arbitrary client-supplied names or aliases.
 *
 * Reuse Daily's hint layout and pitch construction, then reject placeholder
 * facts before issuance. Never include candidate IDs or hint values in errors.
 * The issued-challenge constructor subsequently deep-freezes this snapshot.
 */
export function materializeCustomNineIssuedClueSnapshot(
  orderedCanonicalPlayerIds: readonly string[],
  resolvePlayer: IssuedDailyCluePlayerResolver = getCanonicalDailyPlayer,
  createPitch: DailyPitchFactory = createDailyPuzzlePitch,
): PermanentDailyIssuedClueSnapshot {
  const selection = createCustomNineLineupSelection(orderedCanonicalPlayerIds);
  try {
    const snapshot = materializePermanentDailyIssuedClueSnapshot(
      selection.canonicalPlayerIds,
      resolvePlayer,
      createPitch,
    );

    if (snapshot.pitches.some(pitch =>
      pitch.hintValues.some(value => UNSUPPORTED_HINT_VALUES.has(value))
    )) {
      throw new Error('A requested player has unsupported hint facts.');
    }
    return snapshot;
  } catch {
    // Existing Daily issuance diagnostic messages can contain canonical IDs.
    // Hide those details from caller/logging boundaries for Custom challenges.
    throw new Error('Custom Nine requires nine existing players with complete supported clues.');
  }
}
