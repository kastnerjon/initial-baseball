import {
  CLASSIC_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  type DailyCompletedResult,
  type DailyPublicPuzzle,
} from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import type { DailyCompletedResultRepository } from '@initial-baseball/daily';
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
  it('validates a completed Daily Nine before storing its normalized result', async () => {
    const repository = passthroughRepository('inserted');
    const loadAuthoritativePuzzle = vi.fn().mockResolvedValue(PUZZLE);
    const service = createDailyCompletedResultSubmissionService({ repository, loadAuthoritativePuzzle });

    await expect(service.submit(buildPointsSubmission())).resolves.toEqual({
      ok: true,
      status: 'created',
    });

    expect(loadAuthoritativePuzzle).toHaveBeenCalledWith(PUZZLE.puzzleDate, POINTS_V3_DAILY_RULESET_VERSION);
    expect(repository.insertIfAbsent).toHaveBeenCalledWith(expect.objectContaining({
      submissionId: 'points-result-1',
      puzzleId: PUZZLE.id,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      completedAtBats: expect.arrayContaining([
        expect.objectContaining({ pitchNumber: 1, outcome: 'HR', resolution: 'correct' }),
      ]),
      summary: expect.objectContaining({
        points: 63,
        maximumPoints: 63,
        atBatsCompleted: 9,
        strikeouts: 0,
        completed: true,
      }),
    }));
  });

  it('accepts Classic completion after three strikeout outs and stores only faced at-bats', async () => {
    const repository = passthroughRepository('inserted');
    const service = createDailyCompletedResultSubmissionService({
      repository,
      loadAuthoritativePuzzle: vi.fn().mockResolvedValue(PUZZLE),
    });

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

  it('rejects an incomplete result before the repository boundary', async () => {
    const repository = passthroughRepository('inserted');
    const service = createDailyCompletedResultSubmissionService({
      repository,
      loadAuthoritativePuzzle: vi.fn().mockResolvedValue(PUZZLE),
    });
    const incomplete = buildPointsSubmission();
    incomplete.completedAtBats = incomplete.completedAtBats.slice(0, 8);

    await expect(service.submit(incomplete)).resolves.toEqual({
      ok: false,
      error: 'incomplete_game',
    });
    expect(repository.insertIfAbsent).not.toHaveBeenCalled();
  });

  it('rejects unsupported routing fields before loading a puzzle', async () => {
    const repository = passthroughRepository('inserted');
    const loadAuthoritativePuzzle = vi.fn();
    const service = createDailyCompletedResultSubmissionService({ repository, loadAuthoritativePuzzle });

    await expect(service.submit({
      ...buildPointsSubmission(),
      rulesetVersion: 'points-v2',
    })).resolves.toEqual({
      ok: false,
      error: 'unsupported_ruleset',
    });
    expect(loadAuthoritativePuzzle).not.toHaveBeenCalled();
    expect(repository.insertIfAbsent).not.toHaveBeenCalled();
  });

  it('surfaces 4B idempotency conflict without weakening first-write-wins behavior', async () => {
    const incoming = buildPointsSubmission();
    const repository: DailyCompletedResultRepository = {
      insertIfAbsent: vi.fn(async (result) => ({
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
    const service = createDailyCompletedResultSubmissionService({
      repository,
      loadAuthoritativePuzzle: vi.fn().mockResolvedValue(PUZZLE),
    });

    await expect(service.submit(incoming)).resolves.toEqual({
      ok: false,
      error: 'idempotency_conflict',
    });
  });
});

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
