import 'server-only';
import type {
  PermanentDailyIssuedPuzzleRecord,
  ArchiveBetaDailyClueFrozenIssuedPuzzle,
  PermanentDailyIssuedClueSnapshot,
} from '@initial-baseball/daily';
import { clonePermanentDailyIssuedClueSnapshot } from '@initial-baseball/daily';
import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyPuzzle,
  type Player,
} from '@initial-baseball/shared';
import { createDailyPuzzlePitch, createPlayerIdentity } from './dailyPuzzleAdapters';
import { getCanonicalDailyPlayer } from './canonicalDailyPlayerLookup';

export type PermanentDailyPlayerResolver = (
  canonicalPlayerId: string,
) => Player | null;

/**
 * Materializes the immutable answer snapshot into today's gameplay-ready puzzle
 * shape without changing permanent identity or batting order.
 *
 * The permanent snapshot freezes answer identity/order. Canonical player facts
 * remain sourced through the same gameplay player records used by public Daily.
 */
export function materializePermanentDailyIssuedPuzzle(
  issuedPuzzle: PermanentDailyIssuedPuzzleRecord | ArchiveBetaDailyClueFrozenIssuedPuzzle,
  resolvePlayer: PermanentDailyPlayerResolver = getCanonicalDailyPlayer,
): DailyPuzzle {
  if (issuedPuzzle.schemaVersion === 2) {
    return materializeClueFrozenIssuedPuzzle(issuedPuzzle, resolvePlayer);
  }

  const schemaVersion: unknown = (issuedPuzzle as { schemaVersion: unknown }).schemaVersion;
  if (schemaVersion !== 1) {
    throw new Error(
      `Unsupported permanent Daily issued-puzzle schema version: ${String(schemaVersion)}.`,
    );
  }

  const pitches = issuedPuzzle.canonicalPlayerIds.map((canonicalPlayerId, index) => {
    const player = requirePlayer(issuedPuzzle, canonicalPlayerId, resolvePlayer);
    const pitch = createDailyPuzzlePitch(index + 1, player, issuedPuzzle.identity.puzzleDate);
    return {
      ...pitch,
      player: { ...pitch.player, playerId: canonicalPlayerId },
    };
  });

  return {
    id: issuedPuzzle.puzzleId,
    puzzleNumber: issuedPuzzle.identity.dailyNumber,
    puzzleDate: issuedPuzzle.identity.puzzleDate,
    status: 'published',
    hintConfig: DEFAULT_DAILY_HINT_CONFIG,
    statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches,
  };
}

type ClueFrozenDailyPuzzleInput = Readonly<{
  puzzleId: string;
  puzzleDate: string;
  puzzleNumber: number;
  canonicalPlayerIds: readonly string[];
  clueSnapshot: PermanentDailyIssuedClueSnapshot;
}>;

function materializeClueFrozenIssuedPuzzle(
  issuedPuzzle: Extract<PermanentDailyIssuedPuzzleRecord, { schemaVersion: 2 }> | ArchiveBetaDailyClueFrozenIssuedPuzzle,
  resolvePlayer: PermanentDailyPlayerResolver,
): DailyPuzzle {
  return materializeFrozenDailyPuzzle({
    puzzleId: issuedPuzzle.puzzleId,
    puzzleDate: issuedPuzzle.identity.puzzleDate,
    puzzleNumber: issuedPuzzle.identity.dailyNumber,
    canonicalPlayerIds: issuedPuzzle.canonicalPlayerIds,
    clueSnapshot: issuedPuzzle.clueSnapshot,
  }, resolvePlayer);
}

/**
 * Reuse the legacy frozen-clue gameplay adapter for an independently identified
 * official edition. All hint values and initials come from immutable issuance,
 * never regenerated baseball data. Caller owns date/ID admission.
 */
export function materializeOfficialDailyIssuedPuzzle(
  input: Readonly<Pick<ClueFrozenDailyPuzzleInput, 'puzzleId' | 'puzzleDate' | 'puzzleNumber' | 'clueSnapshot'>>,
  resolvePlayer: PermanentDailyPlayerResolver = getCanonicalDailyPlayer,
): DailyPuzzle {
  try {
    const clueSnapshot = clonePermanentDailyIssuedClueSnapshot(input.clueSnapshot);
    return materializeFrozenDailyPuzzle({
      ...input,
      canonicalPlayerIds: clueSnapshot.pitches.map(pitch => pitch.canonicalPlayerId),
      clueSnapshot,
    }, resolvePlayer);
  } catch {
    // Answers, player IDs and future hints must never enter route errors.
    throw new Error('Unable to materialize the official Daily edition safely.');
  }
}

/** Shared private materializer used by both legacy frozen Dailies and new editions. */
function materializeFrozenDailyPuzzle(
  issuedPuzzle: ClueFrozenDailyPuzzleInput,
  resolvePlayer: PermanentDailyPlayerResolver,
): DailyPuzzle {
  const { clueSnapshot } = issuedPuzzle;
  const pitches = issuedPuzzle.canonicalPlayerIds.map((canonicalPlayerId, index) => {
    const clue = clueSnapshot.pitches[index];
    if (
      clue === undefined
      || clue.pitchNumber !== index + 1
      || clue.canonicalPlayerId !== canonicalPlayerId
    ) {
      throw new Error(
        `Permanent Daily ${issuedPuzzle.puzzleId} clue snapshot does not match frozen batting order at pitch ${index + 1}.`,
      );
    }

    const player = requirePlayer(issuedPuzzle, canonicalPlayerId, resolvePlayer);
    const hints = clueSnapshot.hintLayout.reduce<DailyPuzzle['pitches'][number]['hints']>(
      (result, slot, hintIndex) => {
        const value = clue.hintValues[hintIndex];
        if (typeof value !== 'string' || value.trim().length === 0) {
          throw new Error(
            `Permanent Daily ${issuedPuzzle.puzzleId} clue snapshot has no ${slot.hintType} value at pitch ${index + 1}.`,
          );
        }
        result[slot.hintType] = value;
        return result;
      },
      {},
    );

    return {
      pitchNumber: clue.pitchNumber,
      player: {
        ...createPlayerIdentity(player),
        playerId: canonicalPlayerId,
        initials: clue.initials,
      },
      hints,
    };
  });

  return {
    id: issuedPuzzle.puzzleId,
    puzzleNumber: issuedPuzzle.puzzleNumber,
    puzzleDate: issuedPuzzle.puzzleDate,
    status: 'published',
    hintConfig: clueSnapshot.hintLayout.map((slot) => {
      const currentSlot = DEFAULT_DAILY_HINT_CONFIG.find(
        candidate => candidate.slot === slot.slot,
      );
      if (currentSlot === undefined) {
        throw new Error(
          `Permanent Daily ${issuedPuzzle.puzzleId} has an unsupported frozen hint slot ${slot.slot}.`,
        );
      }
      return { ...slot, result: currentSlot.result };
    }),
    statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches,
  };
}

function requirePlayer(
  issuedPuzzle: Pick<ClueFrozenDailyPuzzleInput, 'puzzleId'>,
  canonicalPlayerId: string,
  resolvePlayer: PermanentDailyPlayerResolver,
): Player {
  const player = resolvePlayer(canonicalPlayerId);
  if (player === null) {
    throw new Error(
      `Permanent Daily ${issuedPuzzle.puzzleId} references unavailable canonical player ${canonicalPlayerId}.`,
    );
  }
  return player;
}
