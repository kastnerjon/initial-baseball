import { describe, expect, it } from 'vitest';
import {
  getDailyStorageKey,
  loadSavedDailyGame,
  loadSavedDailyGameResult,
  saveDailyGame,
} from './dailyLocalStorage';
import {
  DEMO_DAILY_PUZZLE,
  createInitialAtBatUiState,
  createInitialDemoGameState,
} from './mockDailyPuzzle';

const INITIAL_TOKEN = 'initial-progression-token';
const SAVED_TOKEN = 'saved-progression-token';

describe('malformed Daily save decoding', () => {
  it('distinguishes missing, unreadable, unusable and loaded saves', () => {
    const storage = new FakeStorage();

    expect(loadSavedDailyGameResult(
      DEMO_DAILY_PUZZLE,
      INITIAL_TOKEN,
      storage,
    )).toEqual({ status: 'missing' });

    storage.setItem(getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate), '{bad json');
    expect(loadSavedDailyGameResult(
      DEMO_DAILY_PUZZLE,
      INITIAL_TOKEN,
      storage,
    )).toEqual({ status: 'unreadable' });

    persistValidSave(storage);
    mutateStoredSave(storage, saved => {
      delete saved.gameState.shareResult;
    });
    expect(loadSavedDailyGameResult(
      DEMO_DAILY_PUZZLE,
      INITIAL_TOKEN,
      storage,
    )).toEqual({ status: 'unusable' });

    persistValidSave(storage);
    expect(loadSavedDailyGameResult(
      DEMO_DAILY_PUZZLE,
      INITIAL_TOKEN,
      storage,
    )).toMatchObject({
      status: 'loaded',
      loaded: {
        savedGame: {
          progressionToken: SAVED_TOKEN,
        },
      },
    });
  });

  it.each([
    ['missing shareResult', (saved: AnyRecord) => {
      delete saved.gameState.shareResult;
    }],
    ['malformed completed pitch line', (saved: AnyRecord) => {
      saved.gameState.completedPitchLines = [null];
    }],
    ['missing submitted result', (saved: AnyRecord) => {
      delete saved.atBatState.submittedResult;
    }],
    ['malformed pending advance', (saved: AnyRecord) => {
      saved.pendingAdvance = {
        inning: {},
        score: { completed: false },
        pitchLines: null,
        nextPitchIndex: 1,
      };
    }],
  ])('treats %s as unusable without throwing', (_label, mutate) => {
    const storage = new FakeStorage();
    persistValidSave(storage);
    mutateStoredSave(storage, mutate);

    expect(() => loadSavedDailyGame(
      DEMO_DAILY_PUZZLE,
      INITIAL_TOKEN,
      storage,
    )).not.toThrow();

    expect(loadSavedDailyGame(
      DEMO_DAILY_PUZZLE,
      INITIAL_TOKEN,
      storage,
    )).toBeNull();
  });

  it('treats a storage read exception as unreadable rather than throwing', () => {
    const storage = new ThrowingReadStorage();

    expect(() => loadSavedDailyGameResult(
      DEMO_DAILY_PUZZLE,
      INITIAL_TOKEN,
      storage,
    )).not.toThrow();

    expect(loadSavedDailyGameResult(
      DEMO_DAILY_PUZZLE,
      INITIAL_TOKEN,
      storage,
    )).toEqual({ status: 'unreadable' });
  });
});

type AnyRecord = Record<string, any>;

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

class ThrowingReadStorage extends FakeStorage {
  override getItem(): string | null {
    throw new Error('storage blocked');
  }
}

function persistValidSave(storage: FakeStorage): void {
  expect(saveDailyGame(DEMO_DAILY_PUZZLE, {
    currentPitchIndex: 0,
    gameState: createInitialDemoGameState(DEMO_DAILY_PUZZLE),
    atBatState: createInitialAtBatUiState(),
    pendingAdvance: null,
    progressionToken: SAVED_TOKEN,
  }, storage)).toBe(true);
}

function mutateStoredSave(
  storage: FakeStorage,
  mutate: (saved: AnyRecord) => void,
): void {
  const key = getDailyStorageKey(DEMO_DAILY_PUZZLE.puzzleDate);
  const raw = storage.getItem(key);
  if (raw === null) throw new Error('Expected saved Daily game.');

  const saved = JSON.parse(raw) as AnyRecord;
  mutate(saved);
  storage.setItem(key, JSON.stringify(saved));
}
