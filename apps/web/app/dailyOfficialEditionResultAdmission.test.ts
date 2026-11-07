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
