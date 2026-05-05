import { describe, expect, it } from 'vitest';
import type { DailyGameState } from '@initial-baseball/shared';
import type { PendingAtBatAdvance } from './dailyAtBatResolution';
import {
  clearSavedDailyGame,
  getDailyStorageKey,
  loadSavedDailyGame,
  saveDailyGame,
  type SavedDailyGame,
} from './dailyLocalStorage';
import {
  DEMO_DAILY_PUZZLE,
  createInitialAtBatUiState,
  createInitialDemoGameState,
} from './mockDailyPuzzle';

describe('dailyLocalStorage', () => {
  it('generates a stable key from puzzleDate', () => {
    expect(getDailyStorageKey('2026-05-04')).toBe('initial-baseball:daily:2026-05-04');
  });

  it('returns null for missing state', () => {
    const storage = new FakeStorage();

    expect(loadSavedDailyGame(DEMO_DAILY_PUZZLE, storage)).toBeNull();
  });

  it('safely handles invalid JSON', () => {
    const storage = new FakeStorage();
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), '{bad json');

    expect(loadSavedDailyGame(DEMO_DAILY_PUZZLE, storage)).toBeNull();
  });

  it('ignores saved state for the wrong puzzleDate', () => {
    const storage = new FakeStorage();
    const savedGame = buildSavedGame({
      puzzleDate: '2026-05-05',
    });
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(savedGame));

    expect(loadSavedDailyGame(DEMO_DAILY_PUZZLE, storage)).toBeNull();
  });

  it('ignores saved state for the wrong puzzleNumber', () => {
    const storage = new FakeStorage();
    const savedGame = buildSavedGame({
      puzzleNumber: DEMO_DAILY_PUZZLE.puzzleNumber + 1,
    });
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(savedGame));

    expect(loadSavedDailyGame(DEMO_DAILY_PUZZLE, storage)).toBeNull();
  });

  it('ignores saved state missing required fields', () => {
    const storage = new FakeStorage();
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify({
      schemaVersion: 1,
      puzzleDate: DEMO_DAILY_PUZZLE.puzzleDate,
      puzzleNumber: DEMO_DAILY_PUZZLE.puzzleNumber,
    }));

    expect(loadSavedDailyGame(DEMO_DAILY_PUZZLE, storage)).toBeNull();
  });

  it('round-trips a representative saved game state', () => {
    const storage = new FakeStorage();
    const gameState: DailyGameState = {
      ...createInitialDemoGameState(DEMO_DAILY_PUZZLE),
      completedPitchLines: [{ initials: 'KGJ', outcome: 'HR' }],
      status: 'in_progress',
      score: {
        runs: 1,
        hits: 1,
        outs: 0,
        strikeouts: 0,
        completed: false,
      },
    };
    const atBatState = {
      ...createInitialAtBatUiState(),
      query: 'David Wri',
      revealCount: 1 as const,
      strikeCount: 1,
    };
    const pendingAdvance: PendingAtBatAdvance = {
      inning: gameState.inning,
      score: gameState.score,
      pitchLines: gameState.completedPitchLines,
      nextPitchIndex: 1,
    };

    saveDailyGame(DEMO_DAILY_PUZZLE, {
      currentPitchIndex: 1,
      gameState,
      atBatState,
      pendingAdvance,
    }, storage);

    expect(loadSavedDailyGame(DEMO_DAILY_PUZZLE, storage)).toEqual({
      schemaVersion: 1,
      puzzleId: DEMO_DAILY_PUZZLE.id,
      puzzleDate: DEMO_DAILY_PUZZLE.puzzleDate,
      puzzleNumber: DEMO_DAILY_PUZZLE.puzzleNumber,
      currentPitchIndex: 1,
      gameState,
      atBatState,
      pendingAdvance,
    });
  });

  it('clear removes current puzzle storage', () => {
    const storage = new FakeStorage();
    saveDailyGame(DEMO_DAILY_PUZZLE, {
      currentPitchIndex: 0,
      gameState: createInitialDemoGameState(DEMO_DAILY_PUZZLE),
      atBatState: createInitialAtBatUiState(),
      pendingAdvance: null,
    }, storage);

    clearSavedDailyGame(DEMO_DAILY_PUZZLE, storage);

    expect(loadSavedDailyGame(DEMO_DAILY_PUZZLE, storage)).toBeNull();
  });
});

class FakeStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function buildSavedGame(overrides: Partial<SavedDailyGame>): SavedDailyGame {
  return {
    schemaVersion: 1,
    puzzleId: DEMO_DAILY_PUZZLE.id,
    puzzleDate: DEMO_DAILY_PUZZLE.puzzleDate,
    puzzleNumber: DEMO_DAILY_PUZZLE.puzzleNumber,
    currentPitchIndex: 0,
    gameState: createInitialDemoGameState(DEMO_DAILY_PUZZLE),
    atBatState: createInitialAtBatUiState(),
    pendingAdvance: null,
    ...overrides,
  };
}
