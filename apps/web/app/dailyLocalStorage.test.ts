import { describe, expect, it } from 'vitest';
import type { DailyGameState } from '@initial-baseball/shared';
import {
  createGiveUpResult,
  resolveDailyTerminalAtBat,
  type PendingAtBatAdvance,
} from './dailyAtBatResolution';
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
      schemaVersion: 2,
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
      schemaVersion: 2,
      puzzleId: DEMO_DAILY_PUZZLE.id,
      puzzleDate: DEMO_DAILY_PUZZLE.puzzleDate,
      puzzleNumber: DEMO_DAILY_PUZZLE.puzzleNumber,
      currentPitchIndex: 1,
      gameState,
      atBatState,
      pendingAdvance,
    });
  });

  it('preserves an unstarted legacy selected player ID for redirect resolution', () => {
    const storage = new FakeStorage();
    const savedGame = buildSavedGame({
      atBatState: {
        ...createInitialAtBatUiState(),
        selectedPlayerId: 'player-42',
      },
    });
    setLegacySchema(savedGame);
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(savedGame));

    expect(loadSavedDailyGame(DEMO_DAILY_PUZZLE, storage)?.atBatState.selectedPlayerId).toBe('player-42');
    expect(loadSavedDailyGame(DEMO_DAILY_PUZZLE, storage)?.schemaVersion).toBe(2);
  });

  it('sanitizes unstarted legacy saved puzzle answers out of the current storage contract', () => {
    const storage = new FakeStorage();
    const legacySavedGame = buildSavedGame({
      gameState: {
        ...createInitialDemoGameState(DEMO_DAILY_PUZZLE),
        puzzle: DEMO_DAILY_PUZZLE,
      } as unknown as DailyGameState,
    });
    setLegacySchema(legacySavedGame);
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(legacySavedGame));

    const restored = loadSavedDailyGame(DEMO_DAILY_PUZZLE, storage);
    expect(restored?.gameState.puzzle.pitches[0]).toEqual({ pitchNumber: 1, initials: 'KGJ' });
    expect(JSON.stringify(restored?.gameState.puzzle)).not.toContain('Ken Griffey Jr.');
    expect(JSON.stringify(restored?.gameState.puzzle)).not.toContain('correctPlayerId');
  });

  it('invalidates partial legacy hint progress that lacks revealed hint values', () => {
    const storage = new FakeStorage();
    const savedGame = buildSavedGame({
      atBatState: {
        ...createInitialAtBatUiState(),
        revealCount: 2,
        revealedHints: [],
      },
    });
    setLegacySchema(savedGame);
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(savedGame));

    expect(loadSavedDailyGame(DEMO_DAILY_PUZZLE, storage)).toBeNull();
  });

  it('invalidates partial legacy strike progress that cannot be reconstructed safely', () => {
    const storage = new FakeStorage();
    const savedGame = buildSavedGame({
      atBatState: {
        ...createInitialAtBatUiState(),
        strikeCount: 1,
      },
    });
    setLegacySchema(savedGame);
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(savedGame));

    expect(loadSavedDailyGame(DEMO_DAILY_PUZZLE, storage)).toBeNull();
  });

  it('preserves legacy progress at a clean next-at-bat boundary', () => {
    const storage = new FakeStorage();
    const initialGameState = createInitialDemoGameState(DEMO_DAILY_PUZZLE);
    const firstPitch = DEMO_DAILY_PUZZLE.pitches[0];
    if (firstPitch === undefined) {
      throw new Error('Expected a first Daily pitch.');
    }
    const advance = resolveDailyTerminalAtBat({
      gameState: initialGameState,
      pitch: firstPitch,
      result: createGiveUpResult(0, 3),
      currentPitchIndex: 0,
    });
    const savedGame = buildSavedGame({
      currentPitchIndex: 1,
      gameState: {
        ...initialGameState,
        status: 'in_progress',
        inning: advance.inning,
        score: advance.score,
        completedPitchLines: advance.pitchLines,
      },
      atBatState: createInitialAtBatUiState(),
      pendingAdvance: null,
    });
    setLegacySchema(savedGame);
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(savedGame));

    const restored = loadSavedDailyGame(DEMO_DAILY_PUZZLE, storage);
    expect(restored?.currentPitchIndex).toBe(1);
    expect(restored?.gameState.completedPitchLines).toEqual(advance.pitchLines);
    expect(restored?.atBatState).toEqual(createInitialAtBatUiState());
  });

  it('preserves a completed legacy result as read-only history', () => {
    const storage = new FakeStorage();
    const initialGameState = createInitialDemoGameState(DEMO_DAILY_PUZZLE);
    const savedGame = buildSavedGame({
      currentPitchIndex: DEMO_DAILY_PUZZLE.pitches.length,
      gameState: {
        ...initialGameState,
        status: 'completed',
        score: {
          ...initialGameState.score,
          completed: true,
        },
      },
    });
    setLegacySchema(savedGame);
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(savedGame));

    expect(loadSavedDailyGame(DEMO_DAILY_PUZZLE, storage)?.gameState.status).toBe('completed');
  });

  it('normalizes legacy BUNT outcomes to BB when restoring current-schema state', () => {
    const storage = new FakeStorage();
    const savedGame = buildSavedGame({
      gameState: {
        ...createInitialDemoGameState(DEMO_DAILY_PUZZLE),
        completedPitchLines: [{ initials: 'KGJ', outcome: 'BUNT' }],
      } as unknown as DailyGameState,
      atBatState: {
        ...createInitialAtBatUiState(),
        submittedResult: {
          kind: 'correct',
          revealedCount: 4,
          outcome: 'BUNT',
          source: 4,
        },
      } as unknown as SavedDailyGame['atBatState'],
      pendingAdvance: {
        inning: createInitialDemoGameState(DEMO_DAILY_PUZZLE).inning,
        score: createInitialDemoGameState(DEMO_DAILY_PUZZLE).score,
        pitchLines: [{ initials: 'KGJ', outcome: 'BUNT' }],
        nextPitchIndex: 1,
      } as unknown as PendingAtBatAdvance,
    });
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(savedGame));

    const restored = loadSavedDailyGame(DEMO_DAILY_PUZZLE, storage);

    expect(restored?.gameState.completedPitchLines).toEqual([{ initials: 'KGJ', outcome: 'BB' }]);
    expect(restored?.atBatState.submittedResult).toMatchObject({ outcome: 'BB' });
    expect(restored?.pendingAdvance?.pitchLines).toEqual([{ initials: 'KGJ', outcome: 'BB' }]);
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
    schemaVersion: 2,
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

function setLegacySchema(savedGame: SavedDailyGame): void {
  (savedGame as unknown as { schemaVersion: number }).schemaVersion = 1;
}
