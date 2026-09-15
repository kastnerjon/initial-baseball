import { describe, expect, it } from 'vitest';
import { restoreDailyScorecardAnswers } from './dailyScorecard';
import { saveDailyGame, loadSavedDailyGame, clearSavedDailyGame } from './dailyLocalStorage';
import { createGiveUpResult, resolveDailyTerminalAtBat } from './dailyAtBatResolution';
import { createInitialAtBatUiState, createInitialDemoGameState, DEMO_DAILY_PUZZLE } from './mockDailyPuzzle';

describe('scorecard answer retention', () => {
  it('drops malformed names and unresolved slots', () => {
    expect(restoreDailyScorecardAnswers({ 1: 'Andy Benes', 2: 42, 3: '', 4: 'Future Answer' }, [1, 2, 3]))
      .toEqual({ 1: 'Andy Benes' });
    for (const value of [null, undefined, 'name', ['name']]) {
      expect(restoreDailyScorecardAnswers(value, [1])).toEqual({});
    }
  });

  it('retains a terminal answer before and after Next At Bat, and clears it on reset', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); } };
    const gameState = createInitialDemoGameState(DEMO_DAILY_PUZZLE);
    const pendingAdvance = resolveDailyTerminalAtBat({ gameState,
      pitch: { pitchNumber: 1, player: { initials: 'KGJ' } },
      result: createGiveUpResult(0, 3), resolution: 'give_up', wrongGuesses: 0, currentPitchIndex: 0 });
    const input = { currentPitchIndex: 0, gameState, pendingAdvance,
      atBatState: createInitialAtBatUiState(), progressionToken: 'terminal-token',
      scorecardAnswers: { 1: 'Ken Griffey Jr.', 2: 'Future Answer' } };
    saveDailyGame(DEMO_DAILY_PUZZLE, input, storage);
    expect(loadSavedDailyGame(DEMO_DAILY_PUZZLE, 'start', storage)?.scorecardAnswers)
      .toEqual({ 1: 'Ken Griffey Jr.' });
    saveDailyGame(DEMO_DAILY_PUZZLE, { ...input, currentPitchIndex: 1, pendingAdvance: null,
      gameState: { ...gameState, completedAtBats: pendingAdvance.completedAtBats,
        completedPitchLines: pendingAdvance.pitchLines } }, storage);
    expect(loadSavedDailyGame(DEMO_DAILY_PUZZLE, 'start', storage)?.scorecardAnswers)
      .toEqual({ 1: 'Ken Griffey Jr.' });
    clearSavedDailyGame(DEMO_DAILY_PUZZLE, storage);
    expect(loadSavedDailyGame(DEMO_DAILY_PUZZLE, 'start', storage)).toBeNull();
  });
});
