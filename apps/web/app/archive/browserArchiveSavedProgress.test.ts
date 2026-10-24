import { describe, expect, it, vi } from 'vitest';
import { POINTS_V4_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { createInitialAtBatUiState, createInitialDailyGameState } from '../dailyClientState';
import { saveDailyGame } from '../dailyLocalStorage';
import { toPublicDailyPuzzle } from '../dailySavedGameCodec';
import { getDailyModeStorage, getDailyModeStorageKey } from '../dailyModeStorage';
import { DEMO_DAILY_PUZZLE } from '../mockDailyPuzzle';
import { readBrowserArchiveSavedProgress } from './browserArchiveSavedProgress';

const puzzle = toPublicDailyPuzzle({ ...DEMO_DAILY_PUZZLE, id: 'archive-beta-v1-daily-4',
  puzzleDate: '2026-10-20', puzzleNumber: 4 });
const issued = [{ dailyNumber: 4, puzzleDate: '2026-10-20' },
  { dailyNumber: 5, puzzleDate: '2026-10-21' }];
function storage() {
  const data = new Map<string, string>();
  return { data,
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
    removeItem: vi.fn((key: string) => { data.delete(key); }),
  };
}
function put(savedStorage: ReturnType<typeof storage>, changes: {
  hint?: number; strike?: number; pitch?: number; completed?: boolean;
} = {}) {
  const gameState = createInitialDailyGameState(puzzle, POINTS_V4_DAILY_RULESET_VERSION);
  if (changes.completed) gameState.score.completed = true;
  const atBatState = { ...createInitialAtBatUiState(),
    revealCount: (changes.hint ?? 0) as 0 | 1 | 2 | 3 | 4,
    strikeCount: changes.strike ?? 0 };
  expect(saveDailyGame(puzzle, {
    currentPitchIndex: changes.pitch ?? 0,
    gameState, atBatState, pendingAdvance: null,
    progressionToken: 'opaque-signed-token',
  }, getDailyModeStorage(POINTS_V4_DAILY_RULESET_VERSION, savedStorage, puzzle.id))).toBe(true);
}
const key = getDailyModeStorageKey(puzzle.puzzleDate, POINTS_V4_DAILY_RULESET_VERSION, puzzle.id);

describe('browser Archive beta meaningful progress hint', () => {
  it('does not confuse an automatically persisted first open or typed search with gameplay', () => {
    const s = storage(); put(s);
    expect(readBrowserArchiveSavedProgress(s, issued).size).toBe(0);
    const initial = JSON.parse(s.data.get(key)!);
    initial.atBatState.query = 'DiM';
    s.data.set(key, JSON.stringify(initial));
    expect(readBrowserArchiveSavedProgress(s, issued).size).toBe(0);
  });
  it.each([{ hint: 1 }, { strike: 1 }, { pitch: 1 }])(
    'recognizes a saved hint, wrong guess or finished slot: %o', changes => {
      const s = storage(); put(s, changes);
      expect([...readBrowserArchiveSavedProgress(s, issued)])
        .toEqual(['archive-beta-v1-daily-4']);
      expect(s.setItem).toHaveBeenCalledTimes(1); // only test fixture writes
    },
  );
  it('rejects wrong identity, dated save, legacy schema, incompatible ruleset and terminal state', () => {
    for (const patch of [
      { pendingAdvance: undefined },
      { pendingAdvance: {} },
      { pendingAdvance: { nextPitchIndex: 99, pitchLines: [], score: {} } },
      { puzzleId: 'archive-beta-v1-daily-5' },
      { puzzleDate: '2026-10-21' },
      { puzzleNumber: 5 },
      { schemaVersion: 2 },
      { gameState: { rulesetVersion: 'points-v3' } },
      { gameState: { puzzle: { id: 'archive-beta-v1-daily-5' } } },
      { gameState: { status: 'completed' } },
      { gameState: { score: { completed: true } } },
    ]) {
      const s = storage(); put(s, { hint: 1 });
      const saved = JSON.parse(s.data.get(key)!);
      s.data.set(key, JSON.stringify({
        ...saved, ...patch,
        gameState: { ...saved.gameState, ...(patch.gameState ?? {}),
          puzzle: { ...saved.gameState.puzzle, ...('gameState' in patch ? patch.gameState?.puzzle : {}) },
          score: { ...saved.gameState.score, ...('gameState' in patch ? patch.gameState?.score : {}) },
        },
      }));
      expect(readBrowserArchiveSavedProgress(s, issued).size).toBe(0);
    }
  });
  it('fails closed for malformed storage and never reads adjacent games or writes', () => {
    const s = storage();
    s.data.set(key, '{');
    s.data.set(getDailyModeStorageKey(puzzle.puzzleDate, POINTS_V4_DAILY_RULESET_VERSION,
      'archive-beta-v1-daily-5'), JSON.stringify({ puzzleId: puzzle.id, atBatState: { revealCount: 3 } }));
    s.data.set('initial-baseball:daily:2026-10-20', JSON.stringify({ puzzleId: puzzle.id }));
    expect(readBrowserArchiveSavedProgress(s, issued).size).toBe(0);
    expect(s.getItem).toHaveBeenCalledTimes(2);
    expect(s.setItem).not.toHaveBeenCalled();
    expect(s.removeItem).not.toHaveBeenCalled();
    expect(readBrowserArchiveSavedProgress({ getItem: () => { throw Error('Denied'); } }, issued).size).toBe(0);
    expect(readBrowserArchiveSavedProgress(null, issued).size).toBe(0);
  });
});
