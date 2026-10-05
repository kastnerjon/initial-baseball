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
const ARCHIVE_PUZZLE: DailyPublicPuzzle = {
  ...PUZZLE,
  id: 'archive-beta-v1-daily-1',
  puzzleDate: '2026-10-04',
  puzzleNumber: 1,
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
      PUZZLE.id,
    );
    const stored = vi.mocked(repository.insertIfAbsent).mock.calls[0]?.[0];
    expect(stored).toEqual({ ...buildSubmission(), awardedPoints: 5 });
    expect(stored).not.toHaveProperty('answerName');
    expect(stored).not.toHaveProperty('createdAt');
  });

  it('routes points-v4 and stores the engine-derived half-point walk', async () => {
    const repository = passthroughRepository('inserted');
    const loadAuthoritativePuzzle = vi.fn().mockResolvedValue(PUZZLE);
    const service = createService(repository, loadAuthoritativePuzzle);
    const submission = {
      ...buildV4WalkSubmission(),
      awardedPoints: 999,
    };

    await expect(service.submit(submission)).resolves.toEqual({
      ok: true,
      status: 'created',
    });

    expect(loadAuthoritativePuzzle).toHaveBeenCalledWith(
      PUZZLE.puzzleDate,
      POINTS_V4_DAILY_RULESET_VERSION,
      PUZZLE.id,
    );
    expect(vi.mocked(repository.insertIfAbsent).mock.calls[0]?.[0]).toEqual({
      ...buildV4WalkSubmission(),
      awardedPoints: 0.5,
    });
  });

  it('validates and stores an archive result against the exact supplied archive identity', async () => {
    const repository = passthroughRepository('inserted');
    const loadAuthoritativePuzzle = vi.fn().mockResolvedValue(ARCHIVE_PUZZLE);
    const service = createService(repository, loadAuthoritativePuzzle, '2026-10-05');
    const submission = {
      ...buildV4WalkSubmission(),
      puzzleId: ARCHIVE_PUZZLE.id,
      puzzleDate: ARCHIVE_PUZZLE.puzzleDate,
      puzzleNumber: ARCHIVE_PUZZLE.puzzleNumber,
    };

    await expect(service.submit(submission)).resolves.toEqual({ ok: true, status: 'created' });
    expect(loadAuthoritativePuzzle).toHaveBeenCalledWith(
      ARCHIVE_PUZZLE.puzzleDate,
      POINTS_V4_DAILY_RULESET_VERSION,
      ARCHIVE_PUZZLE.id,
    );
    expect(vi.mocked(repository.insertIfAbsent).mock.calls[0]?.[0]).toMatchObject({
      puzzleId: ARCHIVE_PUZZLE.id,
      puzzleDate: ARCHIVE_PUZZLE.puzzleDate,
      puzzleNumber: ARCHIVE_PUZZLE.puzzleNumber,
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
    [{ ...buildSubmission(), puzzleId: '' }, 'invalid_submission'],
    [{ ...buildSubmission(), rulesetVersion: 'classic-inning-v1' }, 'unsupported_ruleset'],
    [{ ...buildSubmission(), rulesetVersion: 'points-v2' }, 'unsupported_ruleset'],
    [{ ...buildSubmission(), puzzleId: ARCHIVE_PUZZLE.id }, 'unsupported_ruleset'],
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
  currentDailyDate = PUZZLE.puzzleDate,
) {
  return createDailyAtBatResultSubmissionService({
    repository,
    loadAuthoritativePuzzle,
    getCurrentDailyDate: () => currentDailyDate,
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


function buildV4WalkSubmission() {
  const base = buildSubmission();
  return {
    ...base,
    attemptId: 'attempt-v4-walk',
    rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
    atBat: {
      ...base.atBat,
      outcome: 'BB' as const,
      hintsRevealed: 4 as const,
      wrongGuesses: 2,
      resolution: 'correct' as const,
    },
  };
}
