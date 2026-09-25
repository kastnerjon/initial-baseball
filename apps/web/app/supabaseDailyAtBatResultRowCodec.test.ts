import {
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
  type DailyAtBatResult,
} from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import {
  decodeDailyAtBatResultRow,
  encodeDailyAtBatResultRow,
} from './supabaseDailyAtBatResultRowCodec';

const RESULT: DailyAtBatResult = {
  schemaVersion: 1,
  attemptId: 'attempt_1',
  puzzleId: 'daily-2026-09-18-editorial-abcd1234',
  puzzleDate: '2026-09-18',
  puzzleNumber: 145,
  rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
  atBat: {
    pitchNumber: 7,
    initials: 'RH',
    outcome: '3B',
    hintsRevealed: 1,
    wrongGuesses: 1,
    resolution: 'correct',
  },
  awardedPoints: 5,
};

const V4_RESULT: DailyAtBatResult = {
  schemaVersion: 1,
  attemptId: 'attempt_v4_1',
  puzzleId: 'daily-2026-09-18-editorial-abcd1234',
  puzzleDate: '2026-09-18',
  puzzleNumber: 145,
  rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
  atBat: {
    pitchNumber: 7,
    initials: 'RH',
    outcome: 'K',
    hintsRevealed: 4,
    wrongGuesses: 3,
    resolution: 'strikeout',
  },
  awardedPoints: -1,
};

describe('resolved-at-bat Supabase row codec', () => {
  it('round-trips every normalized v3 field without provider receipt metadata', () => {
    const row = encodeDailyAtBatResultRow(RESULT);

    expect(row).not.toHaveProperty('created_at');
    expect(decodeDailyAtBatResultRow(row)).toEqual(RESULT);
  });

  it('round-trips a signed points-v4 terminal observation', () => {
    expect(decodeDailyAtBatResultRow(
      encodeDailyAtBatResultRow(V4_RESULT),
    )).toEqual(V4_RESULT);
  });

  it('accepts the exact v4 upper endpoint', () => {
    const row = { ...encodeDailyAtBatResultRow(V4_RESULT), awarded_points: 4 };

    expect(decodeDailyAtBatResultRow(row).awardedPoints).toBe(4);
  });

  it.each([
    ['schema_version', 2],
    ['attempt_id', 'bad id'],
    ['puzzle_id', ' '],
    ['puzzle_date', '2026-02-31'],
    ['puzzle_number', 0],
    ['ruleset_version', 'classic-inning-v1'],
    ['pitch_number', 10],
    ['initials', ' '],
    ['outcome', 'OUT'],
    ['hints_revealed', 5],
    ['wrong_guesses', -1],
    ['resolution', 'pending'],
    ['awarded_points', 8],
    ['awarded_points', -1],
  ])('fails closed on malformed persisted v3 %s', (field, value) => {
    const row = { ...encodeDailyAtBatResultRow(RESULT), [field]: value };

    expectInvalidRow(() => decodeDailyAtBatResultRow(row));
  });

  it.each([-2, 5])('rejects v4 awarded_points %s outside -1..4', awardedPoints => {
    const row = { ...encodeDailyAtBatResultRow(V4_RESULT), awarded_points: awardedPoints };

    expectInvalidRow(() => decodeDailyAtBatResultRow(row));
  });

  it('rejects a non-object provider row', () => {
    expectInvalidRow(() => decodeDailyAtBatResultRow(null));
  });
});

function expectInvalidRow(run: () => unknown): void {
  try {
    run();
  } catch (error) {
    expect(error).toMatchObject({ kind: 'invalid-row' });
    return;
  }
  throw new Error('Expected resolved-at-bat row decoding to fail.');
}
