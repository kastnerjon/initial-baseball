import type { DailyGameState, DailyGuessResult, DailyOutcome, DailyPuzzle, DailySharePitchLine } from '@initial-baseball/shared';
import type { PendingAtBatAdvance } from './dailyAtBatResolution';
import type { DemoAtBatUiState } from './mockDailyPuzzle';

const DAILY_STORAGE_PREFIX = 'initial-baseball:daily';
const DAILY_STORAGE_SCHEMA_VERSION = 1;

type DailyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type SavedDailyGame = {
  schemaVersion: typeof DAILY_STORAGE_SCHEMA_VERSION;
  puzzleId: string;
  puzzleDate: string;
  puzzleNumber: number;
  currentPitchIndex: number;
  gameState: DailyGameState;
  atBatState: DemoAtBatUiState;
  pendingAdvance: PendingAtBatAdvance | null;
};

export type SaveDailyGameInput = {
  currentPitchIndex: number;
  gameState: DailyGameState;
  atBatState: DemoAtBatUiState;
  pendingAdvance: PendingAtBatAdvance | null;
};

export function getDailyStorageKey(puzzleDate: string): string {
  return `${DAILY_STORAGE_PREFIX}:${puzzleDate}`;
}

export function loadSavedDailyGame(
  puzzle: DailyPuzzle,
  storage: DailyStorage | null = getBrowserDailyStorage(),
): SavedDailyGame | null {
  if (storage === null) {
    return null;
  }

  const savedValue = safelyReadStorage(storage, getDailyStorageKey(puzzle.puzzleDate));

  if (savedValue === null) {
    return null;
  }

  const parsedValue = parseSavedValue(savedValue);

  if (!isSavedDailyGameForPuzzle(parsedValue, puzzle)) {
    return null;
  }

  return normalizeSavedDailyGame({
    ...parsedValue,
    atBatState: {
      ...parsedValue.atBatState,
      selectedAcceptedPlayerIds: parsedValue.atBatState.selectedAcceptedPlayerIds
        ?? (parsedValue.atBatState.selectedPlayerId === null ? null : [parsedValue.atBatState.selectedPlayerId]),
    },
  });
}

export function saveDailyGame(
  puzzle: DailyPuzzle,
  input: SaveDailyGameInput,
  storage: DailyStorage | null = getBrowserDailyStorage(),
): void {
  if (storage === null) {
    return;
  }

  const savedGame: SavedDailyGame = {
    schemaVersion: DAILY_STORAGE_SCHEMA_VERSION,
    puzzleId: puzzle.id,
    puzzleDate: puzzle.puzzleDate,
    puzzleNumber: puzzle.puzzleNumber,
    currentPitchIndex: input.currentPitchIndex,
    gameState: input.gameState,
    atBatState: input.atBatState,
    pendingAdvance: input.pendingAdvance,
  };

  safelyWriteStorage(storage, getDailyStorageKey(puzzle.puzzleDate), JSON.stringify(savedGame));
}

export function clearSavedDailyGame(
  puzzle: DailyPuzzle,
  storage: DailyStorage | null = getBrowserDailyStorage(),
): void {
  if (storage === null) {
    return;
  }

  safelyRemoveStorage(storage, getDailyStorageKey(puzzle.puzzleDate));
}

function getBrowserDailyStorage(): DailyStorage | null {
  try {
    return (globalThis as { localStorage?: DailyStorage }).localStorage ?? null;
  } catch {
    return null;
  }
}

function safelyReadStorage(storage: DailyStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safelyWriteStorage(storage: DailyStorage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Persistence should never block gameplay.
  }
}

function safelyRemoveStorage(storage: DailyStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Persistence should never block gameplay.
  }
}

function parseSavedValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isSavedDailyGameForPuzzle(value: unknown, puzzle: DailyPuzzle): value is SavedDailyGame {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.schemaVersion !== DAILY_STORAGE_SCHEMA_VERSION
    || value.puzzleId !== puzzle.id
    || value.puzzleDate !== puzzle.puzzleDate
    || value.puzzleNumber !== puzzle.puzzleNumber
    || typeof value.currentPitchIndex !== 'number'
    || !isRecord(value.gameState)
    || !isRecord(value.atBatState)
    || !(isRecord(value.pendingAdvance) || value.pendingAdvance === null)
  ) {
    return false;
  }

  const gameState = value.gameState;
  const atBatState = value.atBatState;

  return (
    isRecord(gameState.puzzle)
    && gameState.puzzle.id === puzzle.id
    && gameState.puzzle.puzzleDate === puzzle.puzzleDate
    && gameState.puzzle.puzzleNumber === puzzle.puzzleNumber
    && isRecord(gameState.inning)
    && isRecord(gameState.score)
    && Array.isArray(gameState.completedPitchLines)
    && typeof atBatState.query === 'string'
    && (typeof atBatState.selectedPlayerId === 'string' || atBatState.selectedPlayerId === null)
    && (
      isStringArray(atBatState.selectedAcceptedPlayerIds)
      || atBatState.selectedAcceptedPlayerIds === null
      || atBatState.selectedAcceptedPlayerIds === undefined
    )
    && typeof atBatState.revealCount === 'number'
    && typeof atBatState.strikeCount === 'number'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function normalizeSavedDailyGame(savedGame: SavedDailyGame): SavedDailyGame {
  return {
    ...savedGame,
    gameState: {
      ...savedGame.gameState,
      completedPitchLines: savedGame.gameState.completedPitchLines.map(normalizeSharePitchLine),
      shareResult: savedGame.gameState.shareResult === null
        ? null
        : {
            ...savedGame.gameState.shareResult,
            pitchLines: savedGame.gameState.shareResult.pitchLines.map(normalizeSharePitchLine),
          },
    },
    atBatState: {
      ...savedGame.atBatState,
      submittedResult: normalizeDailyGuessResult(savedGame.atBatState.submittedResult),
    },
    pendingAdvance: savedGame.pendingAdvance === null
      ? null
      : {
          ...savedGame.pendingAdvance,
          pitchLines: savedGame.pendingAdvance.pitchLines.map(normalizeSharePitchLine),
        },
  };
}

function normalizeSharePitchLine(line: DailySharePitchLine): DailySharePitchLine {
  return {
    ...line,
    outcome: normalizeLegacyDailyOutcome(line.outcome),
  };
}

function normalizeDailyGuessResult(result: DailyGuessResult | null): DailyGuessResult | null {
  if (result === null || result.kind === 'incorrect' || result.kind === 'strikeout') {
    return result;
  }

  return {
    ...result,
    outcome: normalizeLegacyCorrectOutcome(result.outcome),
  };
}

function normalizeLegacyDailyOutcome(outcome: unknown): DailyOutcome {
  return outcome === 'BUNT' ? 'SAC' : outcome as DailyOutcome;
}

function normalizeLegacyCorrectOutcome(outcome: unknown): Exclude<DailyOutcome, 'K'> {
  return outcome === 'BUNT' ? 'SAC' : outcome as Exclude<DailyOutcome, 'K'>;
}
