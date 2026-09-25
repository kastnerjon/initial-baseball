import type {
  DailyCompletedResult,
  DailyPublicPuzzle,
} from '@initial-baseball/shared';
import {
  CLASSIC_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';
import type { DailyCompletedResultRepository } from '@initial-baseball/daily';
import { describe, expect, it, vi } from 'vitest';
import { createDailyCompletedResultSubmissionService } from './dailyCompletedResultSubmissionService';

const PUZZLE: DailyPublicPuzzle = {
  id: 'daily-2026-09-17-editorial-v1',
  puzzleDate: '2026-09-17',
  puzzleNumber: 144,
  status: 'scheduled',
  hintConfig: [],
  statsHintConfig: { hitter: [], pitcher: [] },
  pitches: Array.from({ length: 9 }, (_, index) => ({
    pitchNumber: index + 1,
    initials: `P${index + 1}`,
  })),
};

describe('completed-result submission service', () => {
  it('validates Daily Nine and stores only the normalized engine result', async () => {
    const repository = passthroughRepository('inserted');
    const loadAuthoritativePuzzle = vi.fn().mockResolvedValue(PUZZLE);
    const service = createService(repository, loadAuthoritativePuzzle);
    const submission = {
      ...buildPointsSubmission(),
      points: 999,
      answerName: 'should be discarded',
    };

    await expect(service.submit(submission)).resolves.toEqual({
      ok: true,
      status: 'created',
    });

    expect(loadAuthoritativePuzzle).toHaveBeenCalledWith(
      PUZZLE.puzzleDate,
      POINTS_V3_DAILY_RULESET_VERSION,
    );
    const stored = vi.mocked(repository.insertIfAbsent).mock.calls[0]?.[0];
    expect(stored).toMatchObject({
      submissionId: 'points-result-1',
      puzzleId: PUZZLE.id,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      summary: {
        points: 63,
        maximumPoints: 63,
        atBatsCompleted: 9,
        totalAtBats: 9,
        completed: true,
        strikeouts: 0,
      },
    });
    expect(stored).not.toHaveProperty('answerName');
  });

  it('validates points-v4 and preserves a signed completed score', async () => {
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
    expect(vi.mocked(repository.insertIfAbsent).mock.calls[0]?.[0]).toMatchObject({
      submissionId: 'points-v4-result-1',
      puzzleId: PUZZLE.id,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      summary: {
        points: -9,
        maximumPoints: 36,
        atBatsCompleted: 9,
        totalAtBats: 9,
        completed: true,
        strikeouts: 9,
      },
    });
  });

  it('accepts Classic completion after three outs and stores only faced at-bats', async () => {
    const repository = passthroughRepository('inserted');
    const service = createService(repository, vi.fn().mockResolvedValue(PUZZLE));

    await expect(service.submit(buildClassicSubmission())).resolves.toEqual({
      ok: true,
      status: 'created',
    });

    const stored = vi.mocked(repository.insertIfAbsent).mock.calls[0]?.[0];
    expect(stored?.completedAtBats).toHaveLength(3);
    expect(stored).toMatchObject({
      rulesetVersion: CLASSIC_DAILY_RULESET_VERSION,
      summary: {
        runs: 0,
        hits: 0,
        outs: 3,
        strikeouts: 3,
        completed: true,
        atBatsCompleted: 3,
        totalAtBats: 9,
      },
    });
  });

  it('rejects incomplete gameplay before persistence', async () => {
    const repository = passthroughRepository('inserted');
    const service = createService(repository, vi.fn().mockResolvedValue(PUZZLE));
    const incomplete = buildPointsSubmission();
    incomplete.completedAtBats = incomplete.completedAtBats.slice(0, 8);

    await expect(service.submit(incomplete)).resolves.toEqual({
      ok: false,
      error: 'incomplete_game',
    });
    expect(repository.insertIfAbsent).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...buildPointsSubmission(), schemaVersion: 2 }, 'unsupported_schema'],
    [{ ...buildPointsSubmission(), rulesetVersion: 'points-v2' }, 'unsupported_ruleset'],
    [{ ...buildPointsSubmission(), puzzleDate: '2026-02-31' }, 'invalid_submission'],
    [{ ...buildPointsSubmission(), puzzleDate: '2026-09-18' }, 'invalid_puzzle'],
  ])('rejects invalid routing before authoritative puzzle loading', async (submission, error) => {
    const repository = passthroughRepository('inserted');
    const loadAuthoritativePuzzle = vi.fn();
    const service = createService(repository, loadAuthoritativePuzzle);

    await expect(service.submit(submission)).resolves.toEqual({ ok: false, error });
    expect(loadAuthoritativePuzzle).not.toHaveBeenCalled();
    expect(repository.insertIfAbsent).not.toHaveBeenCalled();
  });

  it('surfaces the 4B idempotency conflict without overwriting the winner', async () => {
    const repository: DailyCompletedResultRepository = {
      insertIfAbsent: vi.fn(async (result: DailyCompletedResult) => ({
        status: 'existing' as const,
        result: {
          ...result,
          completedAtBats: result.completedAtBats.map((atBat, index) => (
            index === 0 ? { ...atBat, hintsRevealed: 1 as const, outcome: '3B' as const } : atBat
          )),
          summary: {
            ...(result as Extract<DailyCompletedResult, { rulesetVersion: 'points-v3' }>).summary,
            points: 62,
          },
        } as DailyCompletedResult,
      })),
    };
    const service = createService(repository, vi.fn().mockResolvedValue(PUZZLE));

    await expect(service.submit(buildPointsSubmission())).resolves.toEqual({
      ok: false,
      error: 'idempotency_conflict',
    });
  });
});

function createService(
  repository: DailyCompletedResultRepository,
  loadAuthoritativePuzzle: ReturnType<typeof vi.fn>,
) {
  return createDailyCompletedResultSubmissionService({
    repository,
    loadAuthoritativePuzzle,
    getCurrentDailyDate: () => '2026-09-17',
  });
}

function passthroughRepository(status: 'inserted' | 'existing'): DailyCompletedResultRepository {
  return {
    insertIfAbsent: vi.fn(async result => ({ status, result })),
  };
}

function buildPointsSubmission() {
  return {
    schemaVersion: 1 as const,
    submissionId: 'points-result-1',
    puzzleId: PUZZLE.id,
    puzzleDate: PUZZLE.puzzleDate,
    puzzleNumber: PUZZLE.puzzleNumber,
    rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
    completedAtBats: PUZZLE.pitches.map(pitch => ({
      pitchNumber: pitch.pitchNumber,
      initials: pitch.initials,
      outcome: 'HR' as const,
      hintsRevealed: 0 as const,
      wrongGuesses: 0,
      resolution: 'correct' as const,
    })),
  };
}

function buildV4Submission() {
  return {
    schemaVersion: 1 as const,
    submissionId: 'points-v4-result-1',
    puzzleId: PUZZLE.id,
    puzzleDate: PUZZLE.puzzleDate,
    puzzleNumber: PUZZLE.puzzleNumber,
    rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
    completedAtBats: PUZZLE.pitches.map(pitch => ({
      pitchNumber: pitch.pitchNumber,
      initials: pitch.initials,
      outcome: 'K' as const,
      hintsRevealed: 0 as const,
      wrongGuesses: 3,
      resolution: 'strikeout' as const,
    })),
  };
}

function buildClassicSubmission() {
  return {
    schemaVersion: 1 as const,
    submissionId: 'classic-result-1',
    puzzleId: PUZZLE.id,
    puzzleDate: PUZZLE.puzzleDate,
    puzzleNumber: PUZZLE.puzzleNumber,
    rulesetVersion: CLASSIC_DAILY_RULESET_VERSION,
    completedAtBats: PUZZLE.pitches.slice(0, 3).map(pitch => ({
      pitchNumber: pitch.pitchNumber,
      initials: pitch.initials,
      outcome: 'K' as const,
      hintsRevealed: 0 as const,
      wrongGuesses: 3,
      resolution: 'strikeout' as const,
    })),
  };
}
