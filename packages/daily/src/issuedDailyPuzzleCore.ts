import { DAILY_AT_BAT_COUNT } from './dailyPuzzleSelection';
import {
  clonePermanentDailyIssuedClueSnapshot,
  type PermanentDailyIssuedClueSnapshot,
} from './permanentDailyIssuedClueSnapshot';
import {
  ARCHIVE_BETA_DAILY_SERIES_VERSION,
  type ArchiveBetaDailyIdentity,
} from './archiveBetaDailyIdentity';
import {
  PERMANENT_DAILY_SERIES_VERSION,
  type PermanentDailyIdentity,
} from './permanentDailyIdentity';

export const ISSUED_DAILY_PUZZLE_SCHEMA_VERSION = 1 as const;
export const CLUE_FROZEN_ISSUED_DAILY_PUZZLE_SCHEMA_VERSION = 2 as const;

export type IssuedDailyIdentity =
  | PermanentDailyIdentity
  | ArchiveBetaDailyIdentity;

export type IssuedDailyPuzzleInput<I extends IssuedDailyIdentity> = {
  identity: I;
  canonicalPlayerIds: readonly string[];
  issuedAt: string;
};

export type ClueFrozenIssuedDailyPuzzleInput<I extends IssuedDailyIdentity> =
  IssuedDailyPuzzleInput<I> & {
    clueSnapshot: PermanentDailyIssuedClueSnapshot;
  };

export type IssuedDailyPuzzle<I extends IssuedDailyIdentity> = {
  schemaVersion: typeof ISSUED_DAILY_PUZZLE_SCHEMA_VERSION;
  puzzleId: string;
  identity: I;
  canonicalPlayerIds: readonly string[];
  issuedAt: string;
};

export type ClueFrozenIssuedDailyPuzzle<I extends IssuedDailyIdentity> = {
  schemaVersion: typeof CLUE_FROZEN_ISSUED_DAILY_PUZZLE_SCHEMA_VERSION;
  puzzleId: string;
  identity: I;
  canonicalPlayerIds: readonly string[];
  clueSnapshot: PermanentDailyIssuedClueSnapshot;
  issuedAt: string;
};

export type IssuedDailyPuzzleRecord<I extends IssuedDailyIdentity> =
  | IssuedDailyPuzzle<I>
  | ClueFrozenIssuedDailyPuzzle<I>;

export type IssuedDailyPuzzleRepositoryInsertResult<I extends IssuedDailyIdentity> =
  | { status: 'inserted'; puzzle: IssuedDailyPuzzleRecord<I> }
  | { status: 'existing'; puzzle: IssuedDailyPuzzleRecord<I> };

export interface IssuedDailyPuzzleRepository<I extends IssuedDailyIdentity> {
  insertIfAbsent(
    puzzle: IssuedDailyPuzzleRecord<I>,
  ): Promise<IssuedDailyPuzzleRepositoryInsertResult<I>>;
}

export function createIssuedDailyPuzzle<I extends IssuedDailyIdentity>(
  input: IssuedDailyPuzzleInput<I>,
): IssuedDailyPuzzle<I> {
  validateIssuedDailyIdentity(input.identity);
  validateCanonicalPlayerIds(input.identity, input.canonicalPlayerIds);
  const issuedAt = normalizeIssuedAt(input.identity, input.issuedAt);

  return {
    schemaVersion: ISSUED_DAILY_PUZZLE_SCHEMA_VERSION,
    puzzleId: createIssuedDailyPuzzleId(input.identity),
    identity: { ...input.identity },
    canonicalPlayerIds: [...input.canonicalPlayerIds],
    issuedAt,
  };
}

export function createClueFrozenIssuedDailyPuzzle<I extends IssuedDailyIdentity>(
  input: ClueFrozenIssuedDailyPuzzleInput<I>,
): ClueFrozenIssuedDailyPuzzle<I> {
  const legacyEnvelope = createIssuedDailyPuzzle(input);
  const clueSnapshot = clonePermanentDailyIssuedClueSnapshot(input.clueSnapshot);
  const label = getSeriesLabel(input.identity);

  clueSnapshot.pitches.forEach((pitch, index) => {
    const canonicalPlayerId = legacyEnvelope.canonicalPlayerIds[index];
    if (pitch.canonicalPlayerId !== canonicalPlayerId) {
      throw new Error(
        `${label} clue snapshot player at pitch ${pitch.pitchNumber} does not match frozen batting order.`,
      );
    }
  });

  return {
    ...legacyEnvelope,
    schemaVersion: CLUE_FROZEN_ISSUED_DAILY_PUZZLE_SCHEMA_VERSION,
    clueSnapshot,
  };
}

export function cloneIssuedDailyPuzzleRecord<I extends IssuedDailyIdentity>(
  puzzle: IssuedDailyPuzzleRecord<I>,
): IssuedDailyPuzzleRecord<I> {
  const common = {
    puzzleId: puzzle.puzzleId,
    identity: { ...puzzle.identity } as I,
    canonicalPlayerIds: [...puzzle.canonicalPlayerIds],
    issuedAt: puzzle.issuedAt,
  };

  if (puzzle.schemaVersion === ISSUED_DAILY_PUZZLE_SCHEMA_VERSION) {
    return {
      ...common,
      schemaVersion: ISSUED_DAILY_PUZZLE_SCHEMA_VERSION,
    };
  }

  if (puzzle.schemaVersion === CLUE_FROZEN_ISSUED_DAILY_PUZZLE_SCHEMA_VERSION) {
    return {
      ...common,
      schemaVersion: CLUE_FROZEN_ISSUED_DAILY_PUZZLE_SCHEMA_VERSION,
      clueSnapshot: clonePermanentDailyIssuedClueSnapshot(puzzle.clueSnapshot),
    };
  }

  throw new Error(
    `Unsupported issued Daily puzzle schema version: ${String(
      (puzzle as { schemaVersion: unknown }).schemaVersion,
    )}.`,
  );
}

export function createIssuedDailyPuzzleId(identity: IssuedDailyIdentity): string {
  validateIssuedDailyIdentity(identity);
  return `${identity.seriesVersion}-daily-${identity.dailyNumber}`;
}

export function hasSameImmutableIssuedDailyPuzzleContent<I extends IssuedDailyIdentity>(
  left: IssuedDailyPuzzle<I>,
  right: IssuedDailyPuzzle<I>,
): boolean {
  return left.schemaVersion === right.schemaVersion
    && left.puzzleId === right.puzzleId
    && identitiesEqual(left.identity, right.identity)
    && arraysEqual(left.canonicalPlayerIds, right.canonicalPlayerIds);
}

export function areIssuedDailyPuzzlesExactlyEqual<I extends IssuedDailyIdentity>(
  left: IssuedDailyPuzzle<I>,
  right: IssuedDailyPuzzle<I>,
): boolean {
  return hasSameImmutableIssuedDailyPuzzleContent(left, right)
    && left.issuedAt === right.issuedAt;
}

export function hasSameImmutableClueFrozenIssuedDailyContent<I extends IssuedDailyIdentity>(
  left: ClueFrozenIssuedDailyPuzzle<I>,
  right: ClueFrozenIssuedDailyPuzzle<I>,
): boolean {
  return left.puzzleId === right.puzzleId
    && identitiesEqual(left.identity, right.identity)
    && arraysEqual(left.canonicalPlayerIds, right.canonicalPlayerIds)
    && areIssuedDailyClueSnapshotsEqual(left.clueSnapshot, right.clueSnapshot);
}

export function areClueFrozenIssuedDailyPuzzlesExactlyEqual<I extends IssuedDailyIdentity>(
  left: ClueFrozenIssuedDailyPuzzle<I>,
  right: ClueFrozenIssuedDailyPuzzle<I>,
): boolean {
  return hasSameImmutableClueFrozenIssuedDailyContent(left, right)
    && left.issuedAt === right.issuedAt;
}

export function validateIssuedDailySeriesVersion(value: string): void {
  if (
    value !== PERMANENT_DAILY_SERIES_VERSION
    && value !== ARCHIVE_BETA_DAILY_SERIES_VERSION
  ) {
    throw new Error(`Unsupported issued Daily series version: ${value}.`);
  }
}

export function validateIssuedDailyNumber(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error('Issued Daily number must be a positive safe integer.');
  }
}

export function validateIssuedDailyCalendarDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Issued Daily puzzle date must use YYYY-MM-DD.');
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0, 10) !== value
  ) {
    throw new Error('Issued Daily puzzle date is not a valid calendar date.');
  }
}

function validateIssuedDailyIdentity(identity: IssuedDailyIdentity): void {
  validateIssuedDailySeriesVersion(identity.seriesVersion);
  validateIssuedDailyNumber(identity.dailyNumber);
  validateIssuedDailyCalendarDate(identity.puzzleDate);
}

function validateCanonicalPlayerIds(
  identity: IssuedDailyIdentity,
  canonicalPlayerIds: readonly string[],
): void {
  const label = getSeriesLabel(identity);
  if (canonicalPlayerIds.length !== DAILY_AT_BAT_COUNT) {
    throw new Error(
      `${label} issued puzzle must contain exactly ${DAILY_AT_BAT_COUNT} players.`,
    );
  }

  const seen = new Set<string>();
  for (const canonicalPlayerId of canonicalPlayerIds) {
    if (canonicalPlayerId.trim().length === 0) {
      throw new Error(`${label} canonical player ID is required.`);
    }
    if (seen.has(canonicalPlayerId)) {
      throw new Error(`Duplicate ${getSeriesSentenceLabel(identity)} canonical player: ${canonicalPlayerId}.`);
    }
    seen.add(canonicalPlayerId);
  }
}

function normalizeIssuedAt(identity: IssuedDailyIdentity, issuedAt: string): string {
  const timestamp = Date.parse(issuedAt);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid ${getSeriesSentenceLabel(identity)} issued timestamp: ${issuedAt}.`);
  }
  return new Date(timestamp).toISOString();
}

function getSeriesLabel(identity: IssuedDailyIdentity): 'Permanent Daily' | 'Archive beta Daily' {
  return identity.seriesVersion === PERMANENT_DAILY_SERIES_VERSION
    ? 'Permanent Daily'
    : 'Archive beta Daily';
}

function getSeriesSentenceLabel(
  identity: IssuedDailyIdentity,
): 'permanent Daily' | 'archive beta Daily' {
  return identity.seriesVersion === PERMANENT_DAILY_SERIES_VERSION
    ? 'permanent Daily'
    : 'archive beta Daily';
}

function identitiesEqual(
  left: IssuedDailyIdentity,
  right: IssuedDailyIdentity,
): boolean {
  return left.seriesVersion === right.seriesVersion
    && left.puzzleDate === right.puzzleDate
    && left.dailyNumber === right.dailyNumber;
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

export function areIssuedDailyClueSnapshotsEqual(
  left: PermanentDailyIssuedClueSnapshot,
  right: PermanentDailyIssuedClueSnapshot,
): boolean {
  return left.schemaVersion === right.schemaVersion
    && left.hintLayout.length === right.hintLayout.length
    && left.hintLayout.every((slot, index) => {
      const other = right.hintLayout[index];
      return other !== undefined
        && slot.slot === other.slot
        && slot.hintType === other.hintType
        && slot.displayLabel === other.displayLabel;
    })
    && left.pitches.length === right.pitches.length
    && left.pitches.every((pitch, index) => {
      const other = right.pitches[index];
      return other !== undefined
        && pitch.pitchNumber === other.pitchNumber
        && pitch.canonicalPlayerId === other.canonicalPlayerId
        && pitch.initials === other.initials
        && arraysEqual(pitch.hintValues, other.hintValues);
    });
}
