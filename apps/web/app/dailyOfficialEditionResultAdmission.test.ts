import type { DailyAtBatResultRepository, DailyCompletedResultRepository } from '@initial-baseball/daily';
import { describe, expect, it, vi } from 'vitest';
import {
  isDailyResultCollectionEnabled,
  isSecondaryOfficialDailyEditionId,
} from './dailyGameplayPersistenceAuthority';
import { createDailyAtBatResultSubmissionService } from './dailyAtBatResultSubmissionService';
import { createDailyCompletedResultSubmissionService } from './dailyCompletedResultSubmissionService';

const PUZZLE_ID = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const DATE = '2026-11-06';
const primaryId = 'daily-2026-11-06-editorial-abcd1234';

/** Construct service boundaries that must fail before puzzle lookup or DB writing. */
function services() {
  const loadAuthoritativePuzzle = vi.fn();
  const atBatInsert = vi.fn();
  const completedInsert = vi.fn();
  const atBatService = createDailyAtBatResultSubmissionService({
    repository: { insertIfAbsent: atBatInsert } as unknown as DailyAtBatResultRepository,
    loadAuthoritativePuzzle,
    getCurrentDailyDate: () => DATE,
  });
  const completedService = createDailyCompletedResultSubmissionService({
    repository: { insertIfAbsent: completedInsert } as unknown as DailyCompletedResultRepository,
    loadAuthoritativePuzzle,
    getCurrentDailyDate: () => DATE,
  });
  return { atBatService, completedService, loadAuthoritativePuzzle, atBatInsert, completedInsert };
}

describe('secondary official edition result admission remains fail-closed', () => {
  it.each([
    PUZZLE_ID,
    'daily-ed-v1-invalid-user-puzzle-id',
    'daily-ed-v1-6077ee21-9370-4cf3-aa21-74c50b485591',
    'daily-ed-v2-unknown-future-type',
    'daily-ed-unknown-reserved-type',
  ])('rejects both scoring submission paths for reserved edition ID %s', async id => {
    const context = services();
    const base = {
      schemaVersion: 1,
      puzzleId: id,
      puzzleDate: DATE,
      puzzleNumber: 194,
      rulesetVersion: 'points-v4',
    };

    await expect(context.atBatService.submit({
      ...base, attemptId: 'attempt-from-other-edition',
      atBat: { pitchNumber: 1, initials: 'AA', outcome: 'HR' },
    })).resolves.toEqual({ ok: false, error: 'invalid_puzzle' });
    await expect(context.completedService.submit({
      ...base, submissionId: 'result-from-other-edition', completedAtBats: [],
    })).resolves.toEqual({ ok: false, error: 'invalid_puzzle' });

    expect(context.loadAuthoritativePuzzle).not.toHaveBeenCalled();
    expect(context.atBatInsert).not.toHaveBeenCalled();
    expect(context.completedInsert).not.toHaveBeenCalled();
    expect(isDailyResultCollectionEnabled(id)).toBe(false);
  });

  it('preserves primary, Classic and Archive collection policy', () => {
    expect(isSecondaryOfficialDailyEditionId(PUZZLE_ID)).toBe(true);
    expect(isSecondaryOfficialDailyEditionId('daily-ed-v2-unknown-future-type')).toBe(true);
    expect(isSecondaryOfficialDailyEditionId('daily-ed-unknown-reserved-type')).toBe(true);
    expect(isSecondaryOfficialDailyEditionId(primaryId)).toBe(false);
    expect(isDailyResultCollectionEnabled(primaryId)).toBe(true);
    expect(isDailyResultCollectionEnabled(undefined)).toBe(true);
    expect(isDailyResultCollectionEnabled('archive-beta-v1-daily-194')).toBe(true);
    expect(isDailyResultCollectionEnabled('permanent-v1-daily-194')).toBe(false);
    expect(isDailyResultCollectionEnabled('daily-ed-v2-unknown-future-type')).toBe(false);
    expect(isDailyResultCollectionEnabled('daily-ed-unknown-reserved-type')).toBe(false);
  });
});

/** These tests demonstrate why metadata validation alone is not play provenance. */
describe('identical-roster edition relabeling threat model', () => {
  it('keeps both write paths closed even though both roster validators accept relabeled facts', async () => {
    const { validateDailyAtBatResult, validateDailyCompletedResult } = await import('@initial-baseball/engine');
    const siblingId = 'daily-ed-v1-6077ee21-9370-4cf3-aa21-74c50b485591';
    const pitches = Array.from({ length: 9 }, (_, i) => ({ pitchNumber: i + 1, initials: 'AB' }));
    const editionA = { id: PUZZLE_ID, puzzleDate: DATE, puzzleNumber: 194, pitches };
    const editionB = { ...editionA, id: siblingId };
    const facts = pitches.map(pitch => ({ ...pitch, outcome: 'HR' as const,
      hintsRevealed: 0 as const, wrongGuesses: 0, resolution: 'correct' as const }));
    const envelope = { schemaVersion: 1 as const, puzzleId: editionA.id, puzzleDate: DATE,
      puzzleNumber: editionA.puzzleNumber, rulesetVersion: 'points-v4' as const };
    const atBatA = { ...envelope, attemptId: 'attempt-a', atBat: facts[0]! };
    const completionA = { ...envelope, submissionId: 'result-a', completedAtBats: facts };
    const atBatB = { ...atBatA, puzzleId: siblingId };
    const completionB = { ...completionA, puzzleId: siblingId };

    for (const [puzzle, atBat, completion] of [
      [editionA, atBatA, completionA], [editionB, atBatB, completionB],
    ] as const) {
      expect(validateDailyAtBatResult({ submission: atBat, puzzle, rulesetVersion: 'points-v4' }).ok).toBe(true);
      expect(validateDailyCompletedResult({ submission: completion, puzzle, rulesetVersion: 'points-v4' }).ok).toBe(true);
    }
    const context = services();
    await expect(context.atBatService.submit(atBatB)).resolves.toEqual({ ok: false, error: 'invalid_puzzle' });
    await expect(context.completedService.submit(completionB)).resolves.toEqual({ ok: false, error: 'invalid_puzzle' });
    expect(context.loadAuthoritativePuzzle).not.toHaveBeenCalled();
    expect(context.atBatInsert).not.toHaveBeenCalled();
    expect(context.completedInsert).not.toHaveBeenCalled();
  });
});
