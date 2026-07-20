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

const initialProgressionToken = 'initial-progression-token';
const savedProgressionToken = 'saved-progression-token';

describe('dailyLocalStorage', () => {
  it('generates a stable key from puzzleDate', () => {
    expect(getDailyStorageKey('2026-05-04')).toBe('initial-baseball:daily:2026-05-04');
  });

  it('returns null for missing state', () => {
    const storage = new FakeStorage();

    expect(load(storage)).toBeNull();
  });

  it('safely handles invalid JSON', () => {
    const storage = new FakeStorage();
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), '{bad json');

    expect(load(storage)).toBeNull();
  });

  it('ignores saved state for the wrong puzzleDate', () => {
    const storage = new FakeStorage();
    const savedGame = buildSavedGame({ puzzleDate: '2026-05-05' });
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(savedGame));

    expect(load(storage)).toBeNull();
  });

  it('ignores saved state for the wrong puzzleNumber', () => {
    const storage = new FakeStorage();
    const savedGame = buildSavedGame({ puzzleNumber: DEMO_DAILY_PUZZLE.puzzleNumber + 1 });
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(savedGame));

    expect(load(storage)).toBeNull();
  });

  it('ignores current-schema state missing required fields or its progression token', () => {
    const storage = new FakeStorage();
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify({
      schemaVersion: 3,
      puzzleId: DEMO_DAILY_PUZZLE.id,
      puzzleDate: DEMO_DAILY_PUZZLE.puzzleDate,
      puzzleNumber: DEMO_DAILY_PUZZLE.puzzleNumber,
    }));

    expect(load(storage)).toBeNull();

    const savedGame = buildSavedGame({});
    delete (savedGame as unknown as { progressionToken?: string }).progressionToken;
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(savedGame));

    expect(load(storage)).toBeNull();
  });

  it('round-trips representative schema-3 state with its opaque progression token', () => {
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
      progressionToken: savedProgressionToken,
    }, storage);

    expect(load(storage)).toEqual({
      schemaVersion: 3,
      puzzleId: DEMO_DAILY_PUZZLE.id,
      puzzleDate: DEMO_DAILY_PUZZLE.puzzleDate,
      puzzleNumber: DEMO_DAILY_PUZZLE.puzzleNumber,
      currentPitchIndex: 1,
      gameState,
      atBatState,
      pendingAdvance,
      progressionToken: savedProgressionToken,
    });
  });

  it('preserves an untouched schema-1 selected player ID and assigns the initial token', () => {
    const storage = new FakeStorage();
    const savedGame = buildSavedGame({
      atBatState: {
        ...createInitialAtBatUiState(),
        selectedPlayerId: 'player-42',
      },
    });
    setPreTokenSchema(savedGame, 1);
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(savedGame));

    const restored = load(storage);
    expect(restored?.atBatState.selectedPlayerId).toBe('player-42');
    expect(restored?.schemaVersion).toBe(3);
    expect(restored?.progressionToken).toBe(initialProgressionToken);
  });

  it('preserves an untouched schema-2 start with the initial token', () => {
    const storage = new FakeStorage();
    const savedGame = buildSavedGame({});
    setPreTokenSchema(savedGame, 2);
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(savedGame));

    const restored = load(storage);
    expect(restored?.currentPitchIndex).toBe(0);
    expect(restored?.atBatState).toEqual(createInitialAtBatUiState());
    expect(restored?.progressionToken).toBe(initialProgressionToken);
  });

  it('sanitizes pre-token saved puzzle answers out of the current storage contract', () => {
    const storage = new FakeStorage();
    const savedGame = buildSavedGame({
      gameState: {
        ...createInitialDemoGameState(DEMO_DAILY_PUZZLE),
        puzzle: DEMO_DAILY_PUZZLE,
      } as unknown as DailyGameState,
    });
    setPreTokenSchema(savedGame, 1);
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(savedGame));

    const restored = load(storage);
    expect(restored?.gameState.puzzle.pitches[0]).toEqual({ pitchNumber: 1, initials: 'KGJ' });
    expect(JSON.stringify(restored?.gameState.puzzle)).not.toContain('Ken Griffey Jr.');
    expect(JSON.stringify(restored?.gameState.puzzle)).not.toContain('correctPlayerId');
  });

  it('invalidates pre-token partial hint or strike progress', () => {
    const storage = new FakeStorage();
    const hintSave = buildSavedGame({
      atBatState: {
        ...createInitialAtBatUiState(),
        revealCount: 2,
        revealedHints: [],
      },
    });
    setPreTokenSchema(hintSave, 1);
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(hintSave));
    expect(load(storage)).toBeNull();

    const strikeSave = buildSavedGame({
      atBatState: {
        ...createInitialAtBatUiState(),
        strikeCount: 1,
      },
    });
    setPreTokenSchema(strikeSave, 2);
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(strikeSave));
    expect(load(storage)).toBeNull();
  });

  it('invalidates a pre-token next-at-bat boundary because later authorization cannot be reconstructed', () => {
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
    setPreTokenSchema(savedGame, 2);
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(savedGame));

    expect(load(storage)).toBeNull();
  });

  it('preserves a completed pre-token result as read-only history', () => {
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
    setPreTokenSchema(savedGame, 1);
    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), JSON.stringify(savedGame));

    const restored = load(storage);
    expect(restored?.gameState.status).toBe('completed');
    expect(restored?.progressionToken).toBe(initialProgressionToken);
  });

  it('normalizes legacy BUNT outcomes while retaining schema-3 authorization', () => {
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

    const restored = load(storage);
    expect(restored?.gameState.completedPitchLines).toEqual([{ initials: 'KGJ', outcome: 'BB' }]);
    expect(restored?.atBatState.submittedResult).toMatchObject({ outcome: 'BB' });
    expect(restored?.pendingAdvance?.pitchLines).toEqual([{ initials: 'KGJ', outcome: 'BB' }]);
    expect(restored?.progressionToken).toBe(savedProgressionToken);
  });

  it('clear removes current puzzle storage', () => {
    const storage = new FakeStorage();
    saveDailyGame(DEMO_DAILY_PUZZLE, {
      currentPitchIndex: 0,
      gameState: createInitialDemoGameState(DEMO_DAILY_PUZZLE),
      atBatState: createInitialAtBatUiState(),
      pendingAdvance: null,
      progressionToken: savedProgressionToken,
    }, storage);

    clearSavedDailyGame(DEMO_DAILY_PUZZLE, storage);

    expect(load(storage)).toBeNull();
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

function load(storage: FakeStorage) {
  return loadSavedDailyGame(DEMO_DAILY_PUZZLE, initialProgressionToken, storage);
}

function buildSavedGame(overrides: Partial<SavedDailyGame>): SavedDailyGame {
  return {
    schemaVersion: 3,
    puzzleId: DEMO_DAILY_PUZZLE.id,
    puzzleDate: DEMO_DAILY_PUZZLE.puzzleDate,
    puzzleNumber: DEMO_DAILY_PUZZLE.puzzleNumber,
    currentPitchIndex: 0,
    gameState: createInitialDemoGameState(DEMO_DAILY_PUZZLE),
    atBatState: createInitialAtBatUiState(),
    pendingAdvance: null,
    progressionToken: savedProgressionToken,
    ...overrides,
  };
}

function setPreTokenSchema(savedGame: SavedDailyGame, schemaVersion: 1 | 2): void {
  const preToken = savedGame as unknown as { schemaVersion: number; progressionToken?: string };
  preToken.schemaVersion = schemaVersion;
  delete preToken.progressionToken;
}
