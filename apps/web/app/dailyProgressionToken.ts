import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { DailyPuzzle, DailyRevealCount } from '@initial-baseball/shared';

const DAILY_PROGRESSION_TOKEN_VERSION = 1;

export type DailyProgressionState = {
  version: typeof DAILY_PROGRESSION_TOKEN_VERSION;
  puzzleId: string;
  puzzleDate: string;
  pitchNumber: number;
  revealCount: DailyRevealCount;
  strikeCount: number;
  outs: number;
};

export function createInitialDailyProgressionToken(puzzle: DailyPuzzle): string {
  const firstPitch = puzzle.pitches[0];
  if (firstPitch === undefined) {
    throw new Error(`Daily puzzle ${puzzle.id} has no pitches.`);
  }

  return signDailyProgressionState(puzzle, {
    version: DAILY_PROGRESSION_TOKEN_VERSION,
    puzzleId: puzzle.id,
    puzzleDate: puzzle.puzzleDate,
    pitchNumber: firstPitch.pitchNumber,
    revealCount: 0,
    strikeCount: 0,
    outs: 0,
  });
}

export function signDailyProgressionState(
  puzzle: DailyPuzzle,
  state: DailyProgressionState,
): string {
  validateProgressionState(puzzle, state);
  const encodedPayload = Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
  const signature = createHmac('sha256', derivePuzzleSigningKey(puzzle))
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifyDailyProgressionToken(
  puzzle: DailyPuzzle,
  token: string,
): DailyProgressionState {
  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('Malformed Daily progression token.');
  }

  const [encodedPayload, providedSignature] = parts;
  if (!encodedPayload || !providedSignature) {
    throw new Error('Malformed Daily progression token.');
  }

  const expectedSignature = createHmac('sha256', derivePuzzleSigningKey(puzzle))
    .update(encodedPayload)
    .digest('base64url');
  const providedBuffer = Buffer.from(providedSignature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  if (
    providedBuffer.length !== expectedBuffer.length
    || !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid Daily progression token signature.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid Daily progression token payload.');
  }

  if (!isDailyProgressionState(parsed)) {
    throw new Error('Invalid Daily progression token state.');
  }

  validateProgressionState(puzzle, parsed);
  return parsed;
}

function derivePuzzleSigningKey(puzzle: DailyPuzzle): Buffer {
  const hiddenPuzzleMaterial = puzzle.pitches
    .map((pitch) => `${pitch.pitchNumber}:${pitch.player.playerId}`)
    .join('\n');

  return createHash('sha256')
    .update('initial-baseball:daily-progression:v1\n')
    .update(puzzle.id)
    .update('\n')
    .update(puzzle.puzzleDate)
    .update('\n')
    .update(hiddenPuzzleMaterial)
    .digest();
}

function validateProgressionState(
  puzzle: DailyPuzzle,
  state: DailyProgressionState,
): void {
  if (
    state.version !== DAILY_PROGRESSION_TOKEN_VERSION
    || state.puzzleId !== puzzle.id
    || state.puzzleDate !== puzzle.puzzleDate
    || !puzzle.pitches.some((pitch) => pitch.pitchNumber === state.pitchNumber)
    || !isIntegerInRange(state.revealCount, 0, 4)
    || !isIntegerInRange(state.strikeCount, 0, 2)
    || !isIntegerInRange(state.outs, 0, 2)
  ) {
    throw new Error('Daily progression token does not match the published puzzle.');
  }
}

function isDailyProgressionState(value: unknown): value is DailyProgressionState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const state = value as Record<string, unknown>;
  return (
    state.version === DAILY_PROGRESSION_TOKEN_VERSION
    && typeof state.puzzleId === 'string'
    && typeof state.puzzleDate === 'string'
    && typeof state.pitchNumber === 'number'
    && typeof state.revealCount === 'number'
    && typeof state.strikeCount === 'number'
    && typeof state.outs === 'number'
  );
}

function isIntegerInRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}
