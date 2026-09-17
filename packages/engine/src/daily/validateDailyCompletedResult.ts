import {
  CLASSIC_DAILY_RULESET_VERSION,
  DAILY_COMPLETED_RESULT_SCHEMA_VERSION,
  DEFAULT_DAILY_BASE_STATE,
  DEFAULT_DAILY_SCORE_SUMMARY,
  POINTS_V3_DAILY_RULESET_VERSION,
  type DailyCompletedAtBat,
  type DailyCompletedResultError,
  type DailyCompletedResultRulesetVersion,
  type DailyCompletedResultValidation,
  type DailyPublicPuzzle,
  type DailyRevealCount,
} from '@initial-baseball/shared';
import { getGuessOutcome } from '../guesses/getGuessOutcome.js';
import {
  applyDailyOutcomeForRuleset,
  createDailyPointsSummary,
  type DailyRulesetEngineState,
} from './applyDailyRuleset.js';

export type ValidateDailyCompletedResultInput = {
  submission: unknown;
  /** Supplied by the caller's authoritative puzzle lookup, never by the submission. */
  puzzle: Pick<DailyPublicPuzzle, 'id' | 'puzzleDate' | 'puzzleNumber' | 'pitches'>;
  rulesetVersion: DailyCompletedResultRulesetVersion;
};

/** Checks internal consistency, not proof of honest play in the anonymous model. */
export function validateDailyCompletedResult({
  submission,
  puzzle,
  rulesetVersion,
}: ValidateDailyCompletedResultInput): DailyCompletedResultValidation {
  if (!isRecord(submission)) return reject('invalid_submission');
  if (submission.schemaVersion !== DAILY_COMPLETED_RESULT_SCHEMA_VERSION) return reject('unsupported_schema');
  if (typeof submission.submissionId !== 'string'
    || !/^[A-Za-z0-9_-]{1,128}$/.test(submission.submissionId)) return reject('invalid_submission_id');
  if (submission.rulesetVersion !== POINTS_V3_DAILY_RULESET_VERSION
    && submission.rulesetVersion !== CLASSIC_DAILY_RULESET_VERSION) return reject('unsupported_ruleset');
  if (submission.rulesetVersion !== rulesetVersion) return reject('ruleset_mismatch');

  const totalAtBats = puzzle.pitches.length;
  if (totalAtBats !== 9 || puzzle.pitches.some((pitch, index) =>
    pitch.pitchNumber !== index + 1 || !pitch.initials.trim())) return reject('invalid_puzzle');
  if (submission.puzzleId !== puzzle.id || submission.puzzleDate !== puzzle.puzzleDate
    || submission.puzzleNumber !== puzzle.puzzleNumber) return reject('puzzle_mismatch');
  if (!Array.isArray(submission.completedAtBats) || submission.completedAtBats.length > totalAtBats) {
    return reject('invalid_submission');
  }

  let state: DailyRulesetEngineState = {
    inning: {
      inningNumber: 1, outs: 0, maxOuts: 3, bases: { ...DEFAULT_DAILY_BASE_STATE },
      completedAtBats: [], currentAtBat: null,
    },
    score: { ...DEFAULT_DAILY_SCORE_SUMMARY },
    points: createDailyPointsSummary(rulesetVersion, totalAtBats),
  };
  const completedAtBats: DailyCompletedAtBat[] = [];
  for (const [index, fact] of submission.completedAtBats.entries()) {
    if (state.points.completed) return reject('after_completion');
    const pitch = puzzle.pitches[index];
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
    completedAtBats.push(atBat);
    state = applyDailyOutcomeForRuleset({ ...state, ...atBat, rulesetVersion, totalAtBats });
  }
  if (!state.points.completed) return reject('incomplete_game');

  const normalized = {
    schemaVersion: DAILY_COMPLETED_RESULT_SCHEMA_VERSION,
    submissionId: submission.submissionId,
    puzzleId: puzzle.id,
    puzzleDate: puzzle.puzzleDate,
    puzzleNumber: puzzle.puzzleNumber,
    completedAtBats,
  };
  return {
    ok: true,
    result: rulesetVersion === POINTS_V3_DAILY_RULESET_VERSION
      ? { ...normalized, rulesetVersion, summary: { ...state.points, strikeouts: state.score.strikeouts } }
      : {
          ...normalized, rulesetVersion,
          summary: { ...state.score, atBatsCompleted: state.points.atBatsCompleted, totalAtBats },
        },
  };
}

function reject(error: DailyCompletedResultError): DailyCompletedResultValidation {
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
