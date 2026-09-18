import { describe, expect, it } from 'vitest';
import { clearSavedDailyGame, hasPersistedDailyGameValue, saveDailyGame } from './dailyLocalStorage';
import {
  DEMO_DAILY_PUZZLE, createInitialAtBatUiState, createInitialDemoGameState,
} from './mockDailyPuzzle';

describe('Daily local persistence signals', () => {
  it('distinguishes absent storage from an unusable persisted value', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    expect(hasPersistedDailyGameValue(DEMO_DAILY_PUZZLE.puzzleDate, storage)).toBe(false);
    values.set('initial-baseball:daily:' + DEMO_DAILY_PUZZLE.puzzleDate, '{bad-json');
    expect(hasPersistedDailyGameValue(DEMO_DAILY_PUZZLE.puzzleDate, storage)).toBe(true);
  });

  it('reports write/clear failure without throwing', () => {
    const storage = { getItem: () => null, setItem: () => { throw Error('x'); },
      removeItem: () => { throw Error('x'); } };
    expect(saveDailyGame(DEMO_DAILY_PUZZLE, { currentPitchIndex: 0,
      gameState: createInitialDemoGameState(DEMO_DAILY_PUZZLE),
      atBatState: createInitialAtBatUiState(), pendingAdvance: null, progressionToken: 'token',
    }, storage)).toBe(false);
    expect(clearSavedDailyGame(DEMO_DAILY_PUZZLE, storage)).toBe(false);
  });
});
