import {
  CLASSIC_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  type DailyCompletedResult,
} from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import {
  decodeDailyCompletedResultRow,
  encodeDailyCompletedResultRow,
} from './supabaseDailyCompletedResultRowCodec';

const POINTS_RESULT: DailyCompletedResult = {
  schemaVersion: 1,
  submissionId: 'submission_points_1',
  puzzleId: 'daily-2026-09-17-editorial-abcd1234',
  puzzleDate: '2026-09-17',
  puzzleNumber: 144,
  rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
  completedAtBats: Array.from({ length: 9 }, (_, index) => ({
    pitchNumber: index + 1,
    initials: `P${index + 1}`,
    outcome: 'HR' as const,
    hintsRevealed: 0 as const,
    wrongGuesses: 0,
    resolution: 'correct' as const,
  })),
  summary: {
    points: 63,
    maximumPoints: 63,
    atBatsCompleted: 9,
    totalAtBats: 9,
    completed: true,
    strikeouts: 0,
  },
};

const CLASSIC_RESULT: DailyCompletedResult = {
  schemaVersion: 1,
  submissionId: 'submission_classic_1',
  puzzleId: 'daily-2026-09-17-editorial-abcd1234',
  puzzleDate: '2026-09-17',
  puzzleNumber: 144,
  rulesetVersion: CLASSIC_DAILY_RULESET_VERSION,
  completedAtBats: Array.from({ length: 4 }, (_, index) => ({
    pitchNumber: index + 1,
    initials: `C${index + 1}`,
    outcome: index === 3 ? 'K' as const : '1B' as const,
    hintsRevealed: 1 as const,
    wrongGuesses: index === 3 ? 3 : 0,
    resolution: index === 3 ? 'strikeout' as const : 'correct' as const,
  })),
  summary: {
    runs: 1,
    hits: 3,
    outs: 3,
    strikeouts: 1,
    completed: true,
    atBatsCompleted: 4,
    totalAtBats: 9,
  },
};

describe('completed-result Supabase row codec', () => {
  it('round-trips a points-v3 normalized result without adding provider metadata', () => {
    const row = encodeDailyCompletedResultRow(POINTS_RESULT);

    expect(row).not.toHaveProperty('created_at');
    expect(decodeDailyCompletedResultRow(row)).toEqual(POINTS_RESULT);
  });

  it('round-trips a shorter Classic result without assuming nine faced at-bats', () => {
    const row = encodeDailyCompletedResultRow(CLASSIC_RESULT);

    expect(decodeDailyCompletedResultRow(row)).toEqual(CLASSIC_RESULT);
  });

  it('fails closed on malformed persisted summary data', () => {
    const row = {
      ...encodeDailyCompletedResultRow(POINTS_RESULT),
      summary: { ...POINTS_RESULT.summary, points: '63' },
    };

    expect(() => decodeDailyCompletedResultRow(row)).toThrow(
      expect.objectContaining({ kind: 'invalid-row' }),
    );
  });

  it('rejects a syntactically shaped but impossible persisted calendar date', () => {
    const row = {
      ...encodeDailyCompletedResultRow(POINTS_RESULT),
      puzzle_date: '2026-02-31',
    };

    expect(() => decodeDailyCompletedResultRow(row)).toThrow(
      expect.objectContaining({ kind: 'invalid-row' }),
    );
  });

  it('rejects an unsupported persisted ruleset instead of coercing it', () => {
    const row = {
      ...encodeDailyCompletedResultRow(POINTS_RESULT),
      ruleset_version: 'points-v4',
    };

    expect(() => decodeDailyCompletedResultRow(row)).toThrow(
      expect.objectContaining({ kind: 'invalid-row' }),
    );
  });
});
