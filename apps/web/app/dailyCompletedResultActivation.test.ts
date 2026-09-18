import { describe, expect, it } from 'vitest';
import { canCreateCompletedResultFromLoadedSave } from './dailyCompletedResultActivation';
import type { SavedDailyGame } from './dailyLocalStorage';

describe('completed-result activation eligibility', () => {
  it('allows an untouched compatible save even before native facts exist', () => {
    expect(canCreateCompletedResultFromLoadedSave({
      savedGame: savedGame(),
      totalAtBats: 9,
      completedAtBatFactsAreNative: false,
    })).toBe(true);
  });

  it('allows an active save whose explicit completed facts are native', () => {
    expect(canCreateCompletedResultFromLoadedSave({
      savedGame: savedGame({ completedAtBats: [{}] }),
      totalAtBats: 9,
      completedAtBatFactsAreNative: true,
    })).toBe(true);
  });

  it('rejects an active save containing compatibility-reconstructed facts', () => {
    expect(canCreateCompletedResultFromLoadedSave({
      savedGame: savedGame({ completedAtBats: [{}] }),
      totalAtBats: 9,
      completedAtBatFactsAreNative: false,
    })).toBe(false);
  });

  it('never retroactively creates from a restored completed save', () => {
    expect(canCreateCompletedResultFromLoadedSave({
      savedGame: savedGame({ pointsCompleted: true }),
      totalAtBats: 9,
      completedAtBatFactsAreNative: true,
    })).toBe(false);

    expect(canCreateCompletedResultFromLoadedSave({
      savedGame: savedGame({ currentPitchIndex: 9 }),
      totalAtBats: 9,
      completedAtBatFactsAreNative: true,
    })).toBe(false);
  });
});

function savedGame(overrides: {
  completedAtBats?: unknown[];
  pointsCompleted?: boolean;
  currentPitchIndex?: number;
} = {}): SavedDailyGame {
  return {
    currentPitchIndex: overrides.currentPitchIndex ?? 0,
    pendingAdvance: null,
    gameState: {
      points: { completed: overrides.pointsCompleted ?? false },
      score: { completed: false },
      completedAtBats: overrides.completedAtBats ?? [],
    },
  } as unknown as SavedDailyGame;
}
