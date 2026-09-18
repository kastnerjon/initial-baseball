import { describe, expect, it } from 'vitest';
import { POINTS_V3_DAILY_RULESET_VERSION, type DailyAtBatResultSubmission } from '@initial-baseball/shared';
import { validateDailyAtBatResult } from './validateDailyAtBatResult.js';
import { validateDailyCompletedResult } from './validateDailyCompletedResult.js';

const puzzle = {
  id: 'puzzle-1', puzzleDate: '2026-09-18', puzzleNumber: 145,
  pitches: Array.from({ length: 9 }, (_, index) => ({ pitchNumber: index + 1, initials: 'AB' })),
};
const rulesetVersion = POINTS_V3_DAILY_RULESET_VERSION;
function submission(): DailyAtBatResultSubmission {
  return {
    schemaVersion: 1, attemptId: 'attempt-1', puzzleId: puzzle.id,
    puzzleDate: puzzle.puzzleDate, puzzleNumber: puzzle.puzzleNumber, rulesetVersion,
    atBat: { pitchNumber: 9, initials: 'AB', outcome: 'HR', hintsRevealed: 0, wrongGuesses: 0, resolution: 'correct' },
  };
}
const validate = (value: unknown) => validateDailyAtBatResult({ submission: value, puzzle, rulesetVersion });

describe('independent terminal AB observations', () => {
  it('accepts every isolated slot without prior observations or completion', () => {
    for (let pitchNumber = 1; pitchNumber <= 9; pitchNumber++) {
      const value = submission();
      value.atBat.pitchNumber = pitchNumber;
      expect(validate(value)).toEqual({ ok: true, result: { ...value, awardedPoints: 7 } });
    }
  });

  it('matches whole-game scoring for every valid native terminal combination', () => {
    const outcomes = ['HR', '3B', '2B', '1B', 'BB'] as const;
    for (const hintsRevealed of [0, 1, 2, 3, 4] as const) {
      for (const resolution of ['correct', 'strikeout', 'give_up'] as const) {
        for (const wrongGuesses of resolution === 'strikeout' ? [3] : [0, 1, 2]) {
          const value = submission();
          value.atBat = { ...value.atBat, hintsRevealed, wrongGuesses, resolution,
            outcome: resolution === 'correct' ? outcomes[hintsRevealed] : 'K' };
          const result = validate(value);
          const completed = validateDailyCompletedResult({ puzzle, rulesetVersion, submission: {
            ...value, submissionId: value.attemptId,
            completedAtBats: puzzle.pitches.map(pitch => ({ ...value.atBat, ...pitch })),
          } });
          expect(result.ok).toBe(true);
          expect(completed.ok).toBe(true);
          if (result.ok && completed.ok && 'points' in completed.result.summary) {
            expect(result.result.awardedPoints * 9).toBe(completed.result.summary.points);
            expect(result.result.awardedPoints).toBe(resolution === 'correct' ? 7 - hintsRevealed - wrongGuesses : 0);
          }
        }
      }
    }
  });

  it('whitelists, derives and copies rather than trusting score, answer or receipt claims', () => {
    const value = submission();
    Object.freeze(value.atBat);
    const result = validate({ ...value, awardedPoints: 999, answer: 'secret', createdAt: 'fake',
      atBat: { ...value.atBat, awardedPoints: 999, answer: 'secret' } });
    expect(result).toEqual({ ok: true, result: { ...value, awardedPoints: 7 } });
    if (result.ok) {
      result.result.atBat.wrongGuesses = 2;
      expect(value.atBat.wrongGuesses).toBe(0);
    }
  });

  it.each([null, [], 'bad', undefined, 1])('rejects malformed submissions %j', value => {
    expect(validate(value)).toEqual({ ok: false, error: 'invalid_submission' });
  });

  it.each([
    [{ schemaVersion: 2 }, 'unsupported_schema'],
    [{ schemaVersion: '1' }, 'unsupported_schema'],
    [{ attemptId: '' }, 'invalid_attempt_id'],
    [{ attemptId: 'a'.repeat(129) }, 'invalid_attempt_id'],
    [{ attemptId: 'id\n' }, 'invalid_attempt_id'],
    [{ rulesetVersion: 'classic-inning-v1' }, 'unsupported_ruleset'],
    [{ rulesetVersion: 'points-v2' }, 'unsupported_ruleset'],
    [{ puzzleId: 'other' }, 'puzzle_mismatch'],
    [{ puzzleDate: '2026-09-19' }, 'puzzle_mismatch'],
    [{ puzzleNumber: '145' }, 'puzzle_mismatch'],
  ])('rejects invalid envelope %j', (change, error) => {
    expect(validate({ ...submission(), ...change })).toEqual({ ok: false, error });
  });

  it.each([
    [{ pitchNumber: 0 }, 'at_bat_mismatch'], [{ pitchNumber: 10 }, 'at_bat_mismatch'],
    [{ pitchNumber: '9' }, 'at_bat_mismatch'], [{ initials: 'XX' }, 'at_bat_mismatch'],
    [{ hintsRevealed: 5 }, 'invalid_at_bat'], [{ hintsRevealed: 0.5 }, 'invalid_at_bat'],
    [{ wrongGuesses: -1 }, 'invalid_at_bat'], [{ wrongGuesses: NaN }, 'invalid_at_bat'],
    [{ resolution: 'pending' }, 'invalid_at_bat'], [{ outcome: '3B' }, 'inconsistent_at_bat'],
    [{ wrongGuesses: 3 }, 'inconsistent_at_bat'],
    [{ resolution: 'strikeout', outcome: 'K', wrongGuesses: 2 }, 'inconsistent_at_bat'],
    [{ resolution: 'give_up', outcome: 'K', wrongGuesses: 3 }, 'inconsistent_at_bat'],
    [{ resolution: 'give_up', outcome: 'HR' }, 'inconsistent_at_bat'],
  ])('rejects malformed or inconsistent facts %j', (change, error) => {
    const value = submission();
    expect(validate({ ...value, atBat: { ...value.atBat, ...change } })).toEqual({ ok: false, error });
  });

  it.each([null, [], undefined])('rejects absent/non-object fact %j', atBat => {
    expect(validate({ ...submission(), atBat })).toEqual({ ok: false, error: 'invalid_at_bat' });
  });

  it('binds to authoritative game and ordered nine', () => {
    expect(validateDailyAtBatResult({ submission: submission(), puzzle, rulesetVersion: 'classic-inning-v1' }))
      .toEqual({ ok: false, error: 'ruleset_mismatch' });
    for (const pitches of [puzzle.pitches.slice(1), [...puzzle.pitches].reverse(), puzzle.pitches.map(p => ({ ...p, initials: ' ' }))]) {
      expect(validateDailyAtBatResult({ submission: submission(), puzzle: { ...puzzle, pitches }, rulesetVersion }))
        .toEqual({ ok: false, error: 'invalid_puzzle' });
    }
  });
});
