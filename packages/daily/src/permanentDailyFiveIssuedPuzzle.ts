import {
  FIVE_CLUE_FROZEN_ISSUED_DAILY_PUZZLE_SCHEMA_VERSION,
  areFiveClueFrozenIssuedDailyPuzzlesExactlyEqual,
  createFiveClueFrozenIssuedDailyPuzzle,
  createIssuedDailyPuzzleId,
  hasSameImmutableFiveClueFrozenIssuedDailyContent,
  type ClueFrozenIssuedDailyPuzzleInput,
  type FiveClueFrozenIssuedDailyPuzzle,
} from './issuedDailyPuzzleCore';
import {
  PERMANENT_DAILY_SERIES_VERSION,
  type PermanentDailyIdentity,
} from './permanentDailyIdentity';

/**
 * Prospective five-player immutable envelope for outer issued schema v3.
 * Neither this contract nor its constructor writes an issued record.
 * Existing schema-v1/v2 read, write and gameplay paths remain nine-only.
 */
export const PERMANENT_DAILY_FIVE_ISSUED_PUZZLE_SCHEMA_VERSION =
  FIVE_CLUE_FROZEN_ISSUED_DAILY_PUZZLE_SCHEMA_VERSION;

export type PermanentDailyFiveIssuedPuzzleInput =
  ClueFrozenIssuedDailyPuzzleInput<PermanentDailyIdentity>;

export type PermanentDailyFiveIssuedPuzzle =
  FiveClueFrozenIssuedDailyPuzzle<PermanentDailyIdentity>;

export function createPermanentDailyFiveIssuedPuzzle(
  input: PermanentDailyFiveIssuedPuzzleInput,
): PermanentDailyFiveIssuedPuzzle {
  requirePermanentSeries(input.identity);
  return createFiveClueFrozenIssuedDailyPuzzle(input);
}

export function clonePermanentDailyFiveIssuedPuzzle(
  puzzle: PermanentDailyFiveIssuedPuzzle,
): PermanentDailyFiveIssuedPuzzle {
  if (puzzle.schemaVersion !== PERMANENT_DAILY_FIVE_ISSUED_PUZZLE_SCHEMA_VERSION) {
    throw new Error('Expected schema-v3 permanent Daily Five issued puzzle.');
  }
  if (puzzle.puzzleId !== createIssuedDailyPuzzleId(puzzle.identity)) {
    throw new Error('Permanent Daily Five issued puzzle identity does not match puzzle ID.');
  }
  return createPermanentDailyFiveIssuedPuzzle(puzzle);
}

export function hasSameImmutablePermanentDailyFiveContent(
  left: PermanentDailyFiveIssuedPuzzle,
  right: PermanentDailyFiveIssuedPuzzle,
): boolean {
  return hasSameImmutableFiveClueFrozenIssuedDailyContent(left, right);
}

export function arePermanentDailyFivePuzzlesExactlyEqual(
  left: PermanentDailyFiveIssuedPuzzle,
  right: PermanentDailyFiveIssuedPuzzle,
): boolean {
  return areFiveClueFrozenIssuedDailyPuzzlesExactlyEqual(left, right);
}

function requirePermanentSeries(identity: { seriesVersion: unknown }): void {
  if (identity.seriesVersion !== PERMANENT_DAILY_SERIES_VERSION) {
    throw new Error(
      `Unsupported Permanent Daily series version: ${String(identity.seriesVersion)}.`,
    );
  }
}
