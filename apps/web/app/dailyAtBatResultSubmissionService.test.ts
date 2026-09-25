import {
  POINTS_V4_DAILY_RULESET_VERSION,
  type DailyAtBatResult,
  type DailyPublicPuzzle,
} from '@initial-baseball/shared';
import type { DailyAtBatResultRepository } from '@initial-baseball/daily';
import { describe, expect, it, vi } from 'vitest';
import { createDailyAtBatResultSubmissionService } from './dailyAtBatResultSubmissionService';

const PUZZLE: DailyPublicPuzzle = {
  id: 'daily-2026-09-18-editorial-v1',
  puzzleDate: '2026-09-18',
  puzzleNumber: 145,
  status: 'scheduled',
  hintConfig: [],
  statsHintConfig: { hitter: [], pitcher: [] },
  pitches: Array.from({ length: 9 }, (_, index) => ({
    pitchNumber: index + 1,
    initials: `P${index + 1}`,
  })),
};

describe('resolved-at-bat submission service', () => {
  it('stores only the authoritative engine-normalized observation and derived points', async () => {
    const repository = passthroughRepository('inserted');
    const loadAuthoritativePuzzle = vi.fn().mockResolvedValue(PUZZLE);
    const service = createService(repository, loadAuthoritativePuzzle);
    const submission = {
      ...buildSubmission(),
      awardedPoints: 999,
      answerName: 'discard me',
      createdAt: 'client-time',
    };

    await expect(service.submit(submission)).resolves.toEqual({
      ok: true,
      status: 'created',
    });

    expect(loadAuthoritativePuzzle).toHaveBeenCalledWith(
      PUZZLE.puzzleDate,
      'points-v3',
    );
    const stored = vi.mocked(repository.insertIfAbsent).mock.calls[0]?.[0];
    expect(stored).toEqual({ ...buildSubmission(), awardedPoints: 5 });
    expect(stored).not.toHaveProperty('answerName');
    expect(stored).not.toHaveProperty('createdAt');
  });

  it('routes points-v4 and stores signed engine-derived terminal points', async () => {
    const repository = passthroughRepository('inserted');
    const loadAuthoritativePuzzle = vi.fn().mockResolvedValue(PUZZLE);
    const service = createService(repository, loadAuthoritativePuzzle);
    const submission = buildV4Submission();

    await expect(service.submit(submission)).resolves.toEqual({
      ok: true,
      status: 'created',
    });

    expect(loadAuthoritativePuzzle).toHaveBeenCalledWith(
      PUZZLE.puzzleDate,
      POINTS_V4_DAILY_RULESET_VERSION,
    );
    expect(vi.mocked(repository.insertIfAbsent).mock.calls[0]?.[0]).toEqual({
      ...submission,
      awardedPoints: -1,
    });
  });

  it('accepts an isolated later slot without requiring prior observations or completion', async () => {
    const repository = passthroughRepository('existing');
    const service = createService(repository, vi.fn().mockResolvedValue(PUZZLE));

    await expect(service.submit(buildSubmission())).resolves.toEqual({
      ok: true,
      status: 'existing',
    });
    expect(repository.insertIfAbsent).toHaveBeenCalledTimes(1);
  });

  it.each([
    [null, 'invalid_submission'],
    [{ ...buildSubmission(), schemaVersion: 2 }, 'unsupported_schema'],
    [{ ...buildSubmission(), rulesetVersion: 'classic-inning-v1' }, 'unsupported_ruleset'],
    [{ ...buildSubmission(), puzzleDate: '2026-02-31' }, 'invalid_submission'],
    [{ ...buildSubmission(), puzzleDate: '2026-09-19' }, 'invalid_puzzle'],
  ])('rejects invalid routing before puzzle loading', async (submission, error) => {
    const repository = passthroughRepository('inserted');
    const loadAuthoritativePuzzle = vi.fn();
    const service = createService(repository, loadAuthoritativePuzzle);

    await expect(service.submit(submission)).resolves.toEqual({ ok: false, error });
    expect(loadAuthoritativePuzzle).not.toHaveBeenCalled();
    expect(repository.insertIfAbsent).not.toHaveBeenCalled();
  });

  it('rejects a puzzle mismatch after authoritative lookup and before persistence', async () => {
    const repository = passthroughRepository('inserted');
    const service = createService(repository, vi.fn().mockResolvedValue(PUZZLE));

    await expect(service.submit({
      ...buildSubmission(),
      puzzleId: 'different-puzzle',
    })).resolves.toEqual({ ok: false, error: 'puzzle_mismatch' });
    expect(repository.insertIfAbsent).not.toHaveBeenCalled();
  });

  it('surfaces the Daily idempotency conflict without overwriting the winner', async () => {
    const repository: DailyAtBatResultRepository = {
      insertIfAbsent: vi.fn(async (result: DailyAtBatResult) => ({
        status: 'existing' as const,
        result: { ...result, awardedPoints: result.awardedPoints - 1 },
      })),
    };
    const service = createService(repository, vi.fn().mockResolvedValue(PUZZLE));

    await expect(service.submit(buildSubmission())).resolves.toEqual({
      ok: false,
      error: 'idempotency_conflict',
    });
  });
});

function createService(
  repository: DailyAtBatResultRepository,
  loadAuthoritativePuzzle: ReturnType<typeof vi.fn>,
) {
  return createDailyAtBatResultSubmissionService({
    repository,
    loadAuthoritativePuzzle,
    getCurrentDailyDate: () => PUZZLE.puzzleDate,
  });
}

function passthroughRepository(
  status: 'inserted' | 'existing',
): DailyAtBatResultRepository {
  return {
    insertIfAbsent: vi.fn(async result => ({ status, result })),
  };
}

function buildSubmission() {
  return {
    schemaVersion: 1 as const,
    attemptId: 'attempt-1',
    puzzleId: PUZZLE.id,
    puzzleDate: PUZZLE.puzzleDate,
    puzzleNumber: PUZZLE.puzzleNumber,
    rulesetVersion: 'points-v3' as const,
    atBat: {
      pitchNumber: 7,
      initials: 'P7',
      outcome: '3B' as const,
      hintsRevealed: 1 as const,
      wrongGuesses: 1,
      resolution: 'correct' as const,
    },
  };
}

function buildV4Submission() {
  const base = buildSubmission();
  return {
    ...base,
    rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
    atBat: {
      ...base.atBat,
      outcome: 'K' as const,
      wrongGuesses: 3,
      resolution: 'strikeout' as const,
    },
  };
}
