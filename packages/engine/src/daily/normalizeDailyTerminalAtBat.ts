import type { DailyCompletedAtBat, DailyPublicPuzzle, DailyRevealCount } from '@initial-baseball/shared';
import { getGuessOutcome } from '../guesses/getGuessOutcome.js';

type TerminalAtBatValidation =
  | { ok: true; atBat: DailyCompletedAtBat }
  | { ok: false; error: 'invalid_at_bat' | 'at_bat_mismatch' | 'inconsistent_at_bat' };

/** Shared native terminal-fact validation for AB observations and complete games. */
export function normalizeDailyTerminalAtBat(
  fact: unknown,
  pitch: DailyPublicPuzzle['pitches'][number] | undefined,
): TerminalAtBatValidation {
  if (!isRecord(fact) || !isRevealCount(fact.hintsRevealed)
    || !isIntegerWithin(fact.wrongGuesses, 0, 3)
    || (fact.resolution !== 'correct' && fact.resolution !== 'strikeout' && fact.resolution !== 'give_up')) {
    return reject('invalid_at_bat');
  }
  if (!pitch || fact.pitchNumber !== pitch.pitchNumber || fact.initials !== pitch.initials) {
    return reject('at_bat_mismatch');
  }
  if (fact.resolution === 'strikeout' ? fact.wrongGuesses !== 3 : fact.wrongGuesses >= 3) {
    return reject('inconsistent_at_bat');
  }
  const correct = getGuessOutcome({
    isCorrect: true, revealCount: fact.hintsRevealed, strikeCount: fact.wrongGuesses, maxStrikes: 3,
  });
  const outcome = fact.resolution === 'correct' && correct.kind === 'correct' ? correct.outcome : 'K';
  if (fact.outcome !== outcome) return reject('inconsistent_at_bat');

  // Whitelist fields: never retain client totals, answer data, or mutable input references.
  const atBat: DailyCompletedAtBat = {
    pitchNumber: pitch.pitchNumber,
    initials: pitch.initials,
    outcome,
    hintsRevealed: fact.hintsRevealed,
    wrongGuesses: fact.wrongGuesses,
    resolution: fact.resolution,
  };
  return { ok: true, atBat };
}

function reject(error: Extract<TerminalAtBatValidation, { ok: false }>['error']): TerminalAtBatValidation {
  return { ok: false, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIntegerWithin(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isRevealCount(value: unknown): value is DailyRevealCount {
  return isIntegerWithin(value, 0, 4);
}
