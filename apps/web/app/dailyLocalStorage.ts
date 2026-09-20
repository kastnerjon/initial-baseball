import type {
  DailyGameState,
  DailyPublicPuzzle,
  DailyPuzzle,
} from '@initial-baseball/shared';
import type { DailyScorecardAnswers } from './dailyScorecard';
import type { PendingAtBatAdvance } from './dailyAtBatResolution';
import type { DailyAtBatUiState } from './dailyClientState';
import {
  DAILY_STORAGE_SCHEMA_VERSION,
  decodeSavedDailyGame,
  toPublicDailyPuzzle,
  type LoadedSavedDailyGame,
  type SavedDailyGame,
} from './dailySavedGameCodec';

const DAILY_STORAGE_PREFIX = 'initial-baseball:daily';

type DailyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type { LoadedSavedDailyGame, SavedDailyGame } from './dailySavedGameCodec';

export type SavedDailyGameLoadResult =
  | { status: 'missing' }
  | { status: 'unreadable' }
  | { status: 'unusable' }
  | { status: 'loaded'; loaded: LoadedSavedDailyGame };

export type SaveDailyGameInput = {
  currentPitchIndex: number;
  gameState: DailyGameState;
  atBatState: DailyAtBatUiState;
  pendingAdvance: PendingAtBatAdvance | null;
  progressionToken: string;
  scorecardAnswers?: DailyScorecardAnswers;
};

type StorageReadResult =
  | { status: 'missing' }
  | { status: 'unreadable' }
  | { status: 'value'; value: string };

type JsonParseResult =
  | { status: 'unreadable' }
  | { status: 'parsed'; value: unknown };

export function getDailyStorageKey(puzzleDate: string): string {
  return `${DAILY_STORAGE_PREFIX}:${puzzleDate}`;
}

export function hasPersistedDailyGameValue(
  puzzleDate: string,
  storage: Pick<Storage, 'getItem'> | null = getBrowserDailyStorage(),
): boolean {
  if (storage === null) return false;
  return readStorageValue(storage, getDailyStorageKey(puzzleDate)).status === 'value';
}

export function loadSavedDailyGame(
  puzzle: DailyPublicPuzzle | DailyPuzzle,
  initialProgressionToken: string,
  storage: DailyStorage | null = getBrowserDailyStorage(),
): SavedDailyGame | null {
  const result = loadSavedDailyGameResult(puzzle, initialProgressionToken, storage);
  return result.status === 'loaded' ? result.loaded.savedGame : null;
}

export function loadSavedDailyGameWithProvenance(
  puzzle: DailyPublicPuzzle | DailyPuzzle,
  initialProgressionToken: string,
  storage: DailyStorage | null = getBrowserDailyStorage(),
): LoadedSavedDailyGame | null {
  const result = loadSavedDailyGameResult(puzzle, initialProgressionToken, storage);
  return result.status === 'loaded' ? result.loaded : null;
}

export function loadSavedDailyGameResult(
  puzzle: DailyPublicPuzzle | DailyPuzzle,
  initialProgressionToken: string,
  storage: DailyStorage | null = getBrowserDailyStorage(),
): SavedDailyGameLoadResult {
  if (storage === null) return { status: 'unreadable' };

  const read = readStorageValue(storage, getDailyStorageKey(puzzle.puzzleDate));
  if (read.status !== 'value') return read;

  const parsed = parseStoredJson(read.value);
  if (parsed.status === 'unreadable') return parsed;

  const loaded = decodeSavedDailyGame(parsed.value, puzzle, initialProgressionToken);
  return loaded === null
    ? { status: 'unusable' }
    : { status: 'loaded', loaded };
}

export function saveDailyGame(
  puzzle: DailyPublicPuzzle | DailyPuzzle,
  input: SaveDailyGameInput,
  storage: DailyStorage | null = getBrowserDailyStorage(),
): boolean {
  if (storage === null) return false;

  const publicPuzzle = toPublicDailyPuzzle(puzzle);
  const savedGame: SavedDailyGame = {
    schemaVersion: DAILY_STORAGE_SCHEMA_VERSION,
    puzzleId: publicPuzzle.id,
    puzzleDate: publicPuzzle.puzzleDate,
    puzzleNumber: publicPuzzle.puzzleNumber,
    currentPitchIndex: input.currentPitchIndex,
    gameState: input.gameState,
    atBatState: input.atBatState,
    pendingAdvance: input.pendingAdvance,
    progressionToken: input.progressionToken,
    scorecardAnswers: input.scorecardAnswers ?? {},
  };

  return safelyWriteStorage(
    storage,
    getDailyStorageKey(publicPuzzle.puzzleDate),
    JSON.stringify(savedGame),
  );
}

export function clearSavedDailyGame(
  puzzle: DailyPublicPuzzle | DailyPuzzle,
  storage: DailyStorage | null = getBrowserDailyStorage(),
): boolean {
  if (storage === null) return false;
  return safelyRemoveStorage(storage, getDailyStorageKey(puzzle.puzzleDate));
}

function getBrowserDailyStorage(): DailyStorage | null {
  try {
    return (globalThis as { localStorage?: DailyStorage }).localStorage ?? null;
  } catch {
    return null;
  }
}

function readStorageValue(
  storage: Pick<Storage, 'getItem'>,
  key: string,
): StorageReadResult {
  try {
    const value = storage.getItem(key);
    return value === null
      ? { status: 'missing' }
      : { status: 'value', value };
  } catch {
    return { status: 'unreadable' };
  }
}

function parseStoredJson(value: string): JsonParseResult {
  try {
    return { status: 'parsed', value: JSON.parse(value) as unknown };
  } catch {
    return { status: 'unreadable' };
  }
}

function safelyWriteStorage(storage: DailyStorage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    // Persistence should never block gameplay.
    return false;
  }
}

function safelyRemoveStorage(storage: DailyStorage, key: string): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    // Persistence should never block gameplay.
    return false;
  }
}
