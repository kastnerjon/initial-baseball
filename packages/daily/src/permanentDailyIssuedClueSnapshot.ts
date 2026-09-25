import type { HintConfigSlot, HintType } from '@initial-baseball/shared';
import { DAILY_AT_BAT_COUNT } from './dailyPuzzleSelection';

export const PERMANENT_DAILY_ISSUED_CLUE_SNAPSHOT_SCHEMA_VERSION = 1 as const;

const DAILY_HINT_COUNT = 4;
const SUPPORTED_HINT_TYPES: ReadonlySet<HintType> = new Set([
  'main_decade',
  'teams',
  'position',
  'stats',
]);

export type PermanentDailyIssuedHintLayoutSlot = {
  readonly slot: HintConfigSlot['slot'];
  readonly hintType: HintType;
  readonly displayLabel: string;
};

export type PermanentDailyIssuedPitchClueSnapshot = {
  readonly pitchNumber: number;
  readonly canonicalPlayerId: string;
  readonly initials: string;
  readonly hintValues: readonly string[];
};

export type PermanentDailyIssuedClueSnapshotInput = {
  readonly hintLayout: readonly PermanentDailyIssuedHintLayoutSlot[];
  readonly pitches: readonly PermanentDailyIssuedPitchClueSnapshot[];
};

export type PermanentDailyIssuedClueSnapshot = {
  readonly schemaVersion: typeof PERMANENT_DAILY_ISSUED_CLUE_SNAPSHOT_SCHEMA_VERSION;
  readonly hintLayout: readonly PermanentDailyIssuedHintLayoutSlot[];
  readonly pitches: readonly PermanentDailyIssuedPitchClueSnapshot[];
};

/**
 * Portable immutable public-clue snapshot for one permanent Daily.
 *
 * It freezes what the player can see before resolution: the shared four-slot
 * hint layout, each pitch's public initials, and each pitch's four issued hint
 * values. It deliberately does not store outcomes or point values so archive
 * plays can use the ruleset selected when that play starts.
 */
export function createPermanentDailyIssuedClueSnapshot(
  input: PermanentDailyIssuedClueSnapshotInput,
): PermanentDailyIssuedClueSnapshot {
  validateHintLayout(input.hintLayout);
  validatePitches(input.pitches);

  return {
    schemaVersion: PERMANENT_DAILY_ISSUED_CLUE_SNAPSHOT_SCHEMA_VERSION,
    hintLayout: input.hintLayout.map((slot) => ({ ...slot })),
    pitches: clonePitches(input.pitches),
  };
}

export function clonePermanentDailyIssuedClueSnapshot(
  snapshot: PermanentDailyIssuedClueSnapshot,
): PermanentDailyIssuedClueSnapshot {
  if (snapshot.schemaVersion !== PERMANENT_DAILY_ISSUED_CLUE_SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported permanent Daily clue snapshot schema version: ${String(snapshot.schemaVersion)}.`,
    );
  }

  return createPermanentDailyIssuedClueSnapshot({
    hintLayout: snapshot.hintLayout,
    pitches: snapshot.pitches,
  });
}

function validateHintLayout(
  hintLayout: readonly PermanentDailyIssuedHintLayoutSlot[],
): void {
  if (hintLayout.length !== DAILY_HINT_COUNT) {
    throw new Error(
      `Permanent Daily clue snapshot must contain exactly ${DAILY_HINT_COUNT} hint-layout slots.`,
    );
  }

  const seenTypes = new Set<HintType>();
  hintLayout.forEach((hint, index) => {
    const expectedSlot = index + 1;
    if (hint.slot !== expectedSlot) {
      throw new Error(
        `Permanent Daily clue snapshot requires hint slots 1 through ${DAILY_HINT_COUNT}; expected ${expectedSlot} but received ${String(hint.slot)}.`,
      );
    }
    if (!SUPPORTED_HINT_TYPES.has(hint.hintType)) {
      throw new Error(
        `Permanent Daily clue snapshot has unsupported hint type: ${String(hint.hintType)}.`,
      );
    }
    if (seenTypes.has(hint.hintType)) {
      throw new Error(
        `Permanent Daily clue snapshot repeats hint type: ${hint.hintType}.`,
      );
    }
    seenTypes.add(hint.hintType);
    requireNonEmpty(hint.displayLabel, `hint ${hint.slot} display label`);
  });
}

function validatePitches(
  pitches: readonly PermanentDailyIssuedPitchClueSnapshot[],
): void {
  if (pitches.length !== DAILY_AT_BAT_COUNT) {
    throw new Error(
      `Permanent Daily clue snapshot must contain exactly ${DAILY_AT_BAT_COUNT} pitches.`,
    );
  }

  const seenPlayerIds = new Set<string>();
  pitches.forEach((pitch, index) => {
    const expectedPitchNumber = index + 1;
    if (pitch.pitchNumber !== expectedPitchNumber) {
      throw new Error(
        `Permanent Daily clue snapshot requires exact pitch order 1 through ${DAILY_AT_BAT_COUNT}; expected ${expectedPitchNumber} but received ${String(pitch.pitchNumber)}.`,
      );
    }

    requireNonEmpty(pitch.canonicalPlayerId, 'canonical player ID');
    if (seenPlayerIds.has(pitch.canonicalPlayerId)) {
      throw new Error(
        `Duplicate permanent Daily clue snapshot player: ${pitch.canonicalPlayerId}.`,
      );
    }
    seenPlayerIds.add(pitch.canonicalPlayerId);

    requireNonEmpty(pitch.initials, `pitch ${pitch.pitchNumber} initials`);

    if (pitch.hintValues.length !== DAILY_HINT_COUNT) {
      throw new Error(
        `Permanent Daily clue snapshot pitch ${pitch.pitchNumber} must contain exactly ${DAILY_HINT_COUNT} hint values.`,
      );
    }
    pitch.hintValues.forEach((value, hintIndex) => {
      requireNonEmpty(
        value,
        `pitch ${pitch.pitchNumber} hint ${hintIndex + 1} value`,
      );
    });
  });
}

function requireNonEmpty(value: string, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Permanent Daily clue snapshot ${field} is required.`);
  }
}

function clonePitches(
  pitches: readonly PermanentDailyIssuedPitchClueSnapshot[],
): PermanentDailyIssuedPitchClueSnapshot[] {
  return pitches.map((pitch) => ({
    pitchNumber: pitch.pitchNumber,
    canonicalPlayerId: pitch.canonicalPlayerId,
    initials: pitch.initials,
    hintValues: [...pitch.hintValues],
  }));
}
