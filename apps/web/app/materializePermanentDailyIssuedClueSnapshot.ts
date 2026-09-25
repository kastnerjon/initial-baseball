import 'server-only';
import {
  createPermanentDailyIssuedClueSnapshot,
  type PermanentDailyIssuedClueSnapshot,
} from '@initial-baseball/daily';
import {
  DEFAULT_DAILY_HINT_CONFIG,
  type DailyPuzzle,
  type Player,
} from '@initial-baseball/shared';
import { getCanonicalDailyPlayer } from './canonicalDailyPlayerLookup';
import { createDailyPuzzlePitch } from './dailyPuzzleAdapters';

export type PermanentDailyCluePlayerResolver = (
  canonicalPlayerId: string,
) => Player | null;

export type DailyPitchFactory = (
  pitchNumber: number,
  player: Player,
) => DailyPuzzle['pitches'][number];

/**
 * Freeze the public clue values produced by the same lookup, pitch adapter,
 * and default hint layout used by current Daily gameplay.
 */
export function materializePermanentDailyIssuedClueSnapshot(
  orderedCanonicalPlayerIds: readonly string[],
  resolvePlayer: PermanentDailyCluePlayerResolver = getCanonicalDailyPlayer,
  createPitch: DailyPitchFactory = createDailyPuzzlePitch,
): PermanentDailyIssuedClueSnapshot {
  const hintLayout = DEFAULT_DAILY_HINT_CONFIG.map(({ slot, hintType, displayLabel }) => ({
    slot,
    hintType,
    displayLabel,
  }));

  const pitches = orderedCanonicalPlayerIds.map((canonicalPlayerId, index) => {
    const pitchNumber = index + 1;
    const player = resolvePlayer(canonicalPlayerId);
    if (player === null) {
      throw new Error(
        `Permanent Daily clue issuance cannot resolve gameplay-ready canonical player ${canonicalPlayerId}.`,
      );
    }

    // Match the public editorial-puzzle composition: canonical identity is
    // authoritative even when the resolved display record carries a legacy ID.
    const pitch = createPitch(pitchNumber, player);
    const initials = pitch.player.initials;
    if (typeof initials !== 'string' || initials.trim().length === 0) {
      throw new Error(
        `Permanent Daily clue issuance has no public initials for pitch ${pitchNumber} (${canonicalPlayerId}).`,
      );
    }

    const hintValues = DEFAULT_DAILY_HINT_CONFIG.map(({ hintType }) => {
      const value = pitch.hints[hintType];
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(
          `Permanent Daily clue issuance has no public ${hintType} hint for pitch ${pitchNumber} (${canonicalPlayerId}).`,
        );
      }
      return value;
    });

    return {
      pitchNumber,
      canonicalPlayerId,
      initials,
      hintValues,
    };
  });

  return createPermanentDailyIssuedClueSnapshot({ hintLayout, pitches });
}
