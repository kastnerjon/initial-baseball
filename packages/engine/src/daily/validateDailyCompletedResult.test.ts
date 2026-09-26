import { describe, expect, it } from 'vitest';
import {
  CLASSIC_DAILY_RULESET_VERSION as CLASSIC,
  POINTS_V3_DAILY_RULESET_VERSION as NINE,
  POINTS_V4_DAILY_RULESET_VERSION as NINE_V4,
  type DailyCompletedAtBat,
  type DailyCompletedResultRulesetVersion,
  type DailyCompletedResultSubmission,
  type DailyOutcome,
} from '@initial-baseball/shared';
import { validateDailyCompletedResult } from './validateDailyCompletedResult.js';

const puzzle = {
  id: 'beta-puzzle-143-v1', puzzleDate: '2026-09-16', puzzleNumber: 143,
  pitches: ['AB', 'CD', 'EF', 'GH', 'IJ', 'KL', 'MN', 'OP', 'QR']
    .map((initials, index) => ({ pitchNumber: index + 1, initials })),
};
const hints: Record<DailyOutcome, DailyCompletedAtBat['hintsRevealed']> = {
  HR: 0, '3B': 1, '2B': 2, '1B': 3, BB: 4, K: 0,
};

function submission(
  rulesetVersion: DailyCompletedResultRulesetVersion = NINE,
  outcomes: DailyOutcome[] = Array<DailyOutcome>(9).fill('HR'),
): DailyCompletedResultSubmission {
  return {
    schemaVersion: 1, submissionId: 'a1d9cb0a-4c7b-47c1-a1e4-39ae398a25ff',
    puzzleId: puzzle.id, puzzleDate: puzzle.puzzleDate, puzzleNumber: puzzle.puzzleNumber,
    rulesetVersion,
    completedAtBats: outcomes.map((outcome, index) => ({
      pitchNumber: index + 1, initials: puzzle.pitches[index]?.initials ?? 'XX', outcome,
      hintsRevealed: hints[outcome], wrongGuesses: outcome === 'K' ? 3 : 0,
      resolution: outcome === 'K' ? 'strikeout' : 'correct',
    })),
  };
}

function validate(value: unknown, rulesetVersion: DailyCompletedResultRulesetVersion = NINE) {
  return validateDailyCompletedResult({ submission: value, puzzle, rulesetVersion });
}

function withFact(changes: Record<string, unknown>, rulesetVersion: DailyCompletedResultRulesetVersion = NINE) {
  const value = submission(rulesetVersion);
  return { ...value, completedAtBats: [{ ...value.completedAtBats[0], ...changes }, ...value.completedAtBats.slice(1)] };
}

describe('completed-result derivation', () => {
  it('derives Daily Nine points from all native deductions, preserving raw facts', () => {
    const value = submission(NINE, ['HR', '3B', '2B', '1B', 'BB', 'K', 'K', 'HR', 'BB']);
    const wrongGuesses = [0, 1, 2, 0, 2, 3, 1, 2, 0];
    value.completedAtBats = value.completedAtBats.map((fact, index) => ({
      ...fact, wrongGuesses: wrongGuesses[index]!,
      ...(index === 5 ? { hintsRevealed: 4 as const } : {}),
      ...(index === 6 ? { resolution: 'give_up' as const, hintsRevealed: 2 as const } : {}),
    }));
    expect(validate(value)).toEqual({ ok: true, result: { ...value, summary: {
      points: 28, maximumPoints: 63, atBatsCompleted: 9, totalAtBats: 9, completed: true, strikeouts: 2,
    } } });
  });

  it('derives points-v4 from native facts with half-point walks and zero terminal scores', () => {
    const value = submission(NINE_V4, ['HR', '3B', '2B', '1B', 'BB', 'K', 'K', 'HR', 'BB']);
    const wrongGuesses = [2, 1, 2, 0, 2, 3, 1, 2, 0];
    value.completedAtBats = value.completedAtBats.map((fact, index) => ({
      ...fact,
      wrongGuesses: wrongGuesses[index]!,
      ...(index === 6 ? { resolution: 'give_up' as const, hintsRevealed: 2 as const } : {}),
    }));
    expect(validate(value, NINE_V4)).toEqual({ ok: true, result: { ...value, summary: {
      points: 15, maximumPoints: 36, atBatsCompleted: 9, totalAtBats: 9, completed: true, strikeouts: 2,
    } } });
  });

  it.each([
    [Array<DailyOutcome>(9).fill('HR'), 63, 0],
    [Array<DailyOutcome>(9).fill('K'), 0, 9],
    [['K', 'K', 'K', 'HR', 'HR', 'HR', 'HR', 'HR', 'HR'], 42, 3],
  ] as [DailyOutcome[], number, number][])('plays the entire points-v3 Daily Nine %j', (outcomes, points, strikeouts) => {
    expect(validate(submission(NINE, outcomes))).toMatchObject({ ok: true, result: {
      summary: { points, maximumPoints: 63, strikeouts, completed: true },
    } });
  });

  it.each([
    [Array<DailyOutcome>(9).fill('HR'), 36, 0],
    [Array<DailyOutcome>(9).fill('K'), 0, 9],
    [['K', 'K', 'K', 'HR', 'HR', 'HR', 'HR', 'HR', 'HR'], 24, 3],
  ] as [DailyOutcome[], number, number][])('plays the entire points-v4 Daily Nine %j', (outcomes, points, strikeouts) => {
    expect(validate(submission(NINE_V4, outcomes), NINE_V4)).toMatchObject({ ok: true, result: {
      summary: { points, maximumPoints: 36, strikeouts, completed: true },
    } });
  });

  it.each([NINE, NINE_V4, CLASSIC])('accepts every correct hint depth and pre-terminal wrong count for %s', ruleset => {
    for (const outcome of ['HR', '3B', '2B', '1B', 'BB'] as const) {
      for (const wrongGuesses of [0, 1, 2]) {
        const value = withFact({ outcome, hintsRevealed: hints[outcome], wrongGuesses }, ruleset);
        expect(validate(value, ruleset).ok).toBe(true);
      }
    }
  });

  it('derives Classic forced walks, a grand slam and the exact third-out boundary', () => {
    const value = submission(CLASSIC, ['BB', 'BB', 'BB', 'BB', 'HR', 'K', 'K', 'K']);
    value.completedAtBats[6] = { ...value.completedAtBats[6]!, resolution: 'give_up', wrongGuesses: 2 };
    expect(validate(value, CLASSIC)).toEqual({ ok: true, result: { ...value, summary: {
      runs: 5, hits: 1, outs: 3, strikeouts: 3, completed: true, atBatsCompleted: 8, totalAtBats: 9,
    } } });
  });

  it.each([
    [['1B', '2B', '3B', 'K', 'K', 'K'], 2, 3, 3],
    [Array<DailyOutcome>(9).fill('HR'), 9, 9, 0],
    [['HR', 'HR', 'HR', 'HR', 'HR', 'HR', 'K', 'K', 'K'], 6, 6, 3],
    [['K', 'K', 'K'], 0, 0, 3],
  ] as [DailyOutcome[], number, number, number][])('derives Classic %j', (outcomes, runs, hits, outs) => {
    const result = validate(submission(CLASSIC, outcomes), CLASSIC);
    expect(result).toMatchObject({ ok: true, result: {
      summary: { runs, hits, outs, strikeouts: outs, atBatsCompleted: outcomes.length, completed: true },
    } });
    if (result.ok) expect(result.result.summary).not.toHaveProperty('points');
  });

  it('keeps independently selected puzzle and game identities', () => {
    const value = submission(CLASSIC);
    expect(validate(value)).toEqual({ ok: false, error: 'ruleset_mismatch' });
    const separatePuzzle = { ...puzzle, id: 'separate-classic-lineup-v1' };
    expect(validateDailyCompletedResult({
      submission: { ...value, puzzleId: separatePuzzle.id }, puzzle: separatePuzzle, rulesetVersion: CLASSIC,
    })).toMatchObject({ ok: true, result: { puzzleId: separatePuzzle.id, rulesetVersion: CLASSIC } });
  });

  it('normalizes deterministically, ignores forged summaries/extras and detaches input references', () => {
    const value = submission();
    const serialized = JSON.stringify(value);
    value.completedAtBats.forEach(Object.freeze);
    Object.freeze(value.completedAtBats);
    Object.freeze(value);
    const expected = validate(value);
    const embellished = {
      ...value, summary: { points: 99999 }, completedAt: 'client-time', answer: 'Hidden Answer',
      completedAtBats: value.completedAtBats.map(fact => ({ points: 99999, answer: 'Hidden Answer', ...fact })),
    };
    const result = validate(embellished);
    expect(result).toEqual(expected);
    expect(JSON.stringify(result)).not.toMatch(/99999|Hidden Answer|client-time/);
    expect(JSON.stringify(value)).toBe(serialized);
    if (result.ok) {
      result.result.completedAtBats[0]!.wrongGuesses = 2;
      expect(embellished.completedAtBats[0]!.wrongGuesses).toBe(0);
      expect(validate(JSON.parse(serialized))).toEqual(expected);
    }
  });
});

describe('completed-result rejection', () => {
  it.each([null, undefined, [], 'result', 1, true])('rejects non-record payload %j', value => {
    expect(validate(value)).toEqual({ ok: false, error: 'invalid_submission' });
  });

  it.each([undefined, null, '1', 0, 2])('rejects unsupported schema %j', schemaVersion => {
    expect(validate({ ...submission(), schemaVersion })).toEqual({ ok: false, error: 'unsupported_schema' });
  });

  it.each([undefined, null, 4, '', ' ', ' id ', 'line\nbreak', 'a'.repeat(129)])('rejects invalid ID %j', submissionId => {
    expect(validate({ ...submission(), submissionId })).toEqual({ ok: false, error: 'invalid_submission_id' });
  });

  it.each(['points-v1', 'points-v2', 'legacy-inning-v1', undefined])('rejects %s analytics', rulesetVersion => {
    expect(validate({ ...submission(), rulesetVersion })).toEqual({ ok: false, error: 'unsupported_ruleset' });
  });

  it.each([
    { puzzleId: 'different-puzzle-version' }, { puzzleDate: '2026-09-17' }, { puzzleNumber: 1 },
    { puzzleId: undefined }, { puzzleDate: undefined }, { puzzleNumber: '143' },
  ])('rejects spoofed/missing puzzle identity %j', changes => {
    expect(validate({ ...submission(), ...changes })).toEqual({ ok: false, error: 'puzzle_mismatch' });
  });

  it.each([null, {}, 'facts', Array(10).fill({})])('rejects invalid at-bat collection %j', completedAtBats => {
    expect(validate({ ...submission(), completedAtBats })).toEqual({ ok: false, error: 'invalid_submission' });
  });

  it.each([NINE, NINE_V4, CLASSIC])('rejects incomplete %s games', ruleset => {
    for (const outcomes of [[], ['K', 'K'], Array<DailyOutcome>(8).fill('HR')] as DailyOutcome[][]) {
      expect(validate(submission(ruleset, outcomes), ruleset)).toEqual({ ok: false, error: 'incomplete_game' });
    }
  });

  it('rejects any Classic fact after the third out', () => {
    expect(validate(submission(CLASSIC, ['K', 'K', 'K', 'HR']), CLASSIC))
      .toEqual({ ok: false, error: 'after_completion' });
  });

  it.each([NINE, NINE_V4, CLASSIC])('validates faced order and initials for %s', ruleset => {
    for (const change of [{ pitchNumber: 2 }, { pitchNumber: '1' }, { initials: 'ZZ' }, { initials: 'ab' }]) {
      expect(validate(withFact(change, ruleset), ruleset)).toEqual({ ok: false, error: 'at_bat_mismatch' });
    }
    const value = submission(ruleset);
    value.completedAtBats[1] = value.completedAtBats[0]!;
    expect(validate(value, ruleset)).toEqual({ ok: false, error: 'at_bat_mismatch' });
  });

  it.each([NINE, NINE_V4, CLASSIC])('rejects malformed native facts for %s', ruleset => {
    for (const field of ['hintsRevealed', 'wrongGuesses']) {
      for (const invalid of [undefined, null, '0', -1, 0.5, NaN, Infinity, 5]) {
        expect(validate(withFact({ [field]: invalid }, ruleset), ruleset))
          .toEqual({ ok: false, error: 'invalid_at_bat' });
      }
    }
    for (const fact of [null, [], 'fact', undefined, { resolution: 'unknown' }]) {
      const value = submission(ruleset);
      expect(validate({ ...value, completedAtBats: [fact, ...value.completedAtBats.slice(1)] }, ruleset))
        .toEqual({ ok: false, error: 'invalid_at_bat' });
    }
  });

  it.each([NINE, NINE_V4, CLASSIC])('rejects inconsistent terminal facts for %s', ruleset => {
    for (const change of [
      { outcome: 'SAC' }, { outcome: 'K' }, { outcome: '3B', hintsRevealed: 0 },
      { outcome: 'HR', hintsRevealed: 4 }, { wrongGuesses: 3 },
      { resolution: 'strikeout', outcome: 'K', wrongGuesses: 2 },
      { resolution: 'strikeout', outcome: 'HR', wrongGuesses: 3 },
      { resolution: 'give_up', outcome: 'K', wrongGuesses: 3 },
      { resolution: 'give_up', outcome: 'HR', wrongGuesses: 0 },
    ]) {
      expect(validate(withFact(change, ruleset), ruleset)).toEqual({ ok: false, error: 'inconsistent_at_bat' });
    }
  });

  it('requires the authoritative scheduled nine in order', () => {
    for (const pitches of [puzzle.pitches.slice(0, 8), [...puzzle.pitches].reverse()]) {
      expect(validateDailyCompletedResult({ submission: submission(), puzzle: { ...puzzle, pitches }, rulesetVersion: NINE }))
        .toEqual({ ok: false, error: 'invalid_puzzle' });
    }
  });
});
