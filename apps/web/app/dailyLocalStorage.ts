import type {
  DailyGameState,
  DailyGuessResult,
  DailyOutcome,
  DailyPublicPuzzle,
  DailyPuzzle,
  DailySharePitchLine,
} from '@initial-baseball/shared';
import type { PendingAtBatAdvance } from './dailyAtBatResolution';
import type { DailyAtBatUiState } from './dailyClientState';

const DAILY_STORAGE_PREFIX = 'initial-baseball:daily';
const DAILY_STORAGE_SCHEMA_VERSION = 2;

type DailyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type SavedDailyGame = {
  schemaVersion: typeof DAILY_STORAGE_SCHEMA_VERSION;
  puzzleId: string;
  puzzleDate: string;
  puzzleNumber: number;
  currentPitchIndex: number;
  gameState: DailyGameState;
  atBatState: DailyAtBatUiState;
  pendingAdvance: PendingAtBatAdvance | null;
};

type PersistedSavedDailyGame = Omit<SavedDailyGame, 'schemaVersion'> & {
  schemaVersion: 1 | typeof DAILY_STORAGE_SCHEMA_VERSION;
};

export type SaveDailyGameInput = {
  currentPitchIndex: number;
  gameState: DailyGameState;
  atBatState: DailyAtBatUiState;
  pendingAdvance: PendingAtBatAdvance | null;
};

export function getDailyStorageKey(puzzleDate: string): string {
  return `${DAILY_STORAGE_PREFIX}:${puzzleDate}`;
}

export function loadSavedDailyGame(
  puzzle: DailyPublicPuzzle | DailyPuzzle,
  storage: DailyStorage | null = getBrowserDailyStorage(),
): SavedDailyGame | null {
  if (storage === null) {
    return null;
  }

  const publicPuzzle = toPublicPuzzle(puzzle);
  const savedValue = safelyReadStorage(storage, getDailyStorageKey(publicPuzzle.puzzleDate));

  if (savedValue === null) {
    return null;
  }

  const parsedValue = parseSavedValue(savedValue);

  if (!isSavedDailyGameForPuzzle(parsedValue, publicPuzzle)) {
    return null;
  }

  return normalizeSavedDailyGame(parsedValue, publicPuzzle);
}

export function saveDailyGame(
  puzzle: DailyPublicPuzzle | DailyPuzzle,
  input: SaveDailyGameInput,
  storage: DailyStorage | null = getBrowserDailyStorage(),
): void {
  if (storage === null) {
    return;
  }

  const publicPuzzle = toPublicPuzzle(puzzle);
  const savedGame: SavedDailyGame = {
    schemaVersion: DAILY_STORAGE_SCHEMA_VERSION,
    puzzleId: publicPuzzle.id,
    puzzleDate: publicPuzzle.puzzleDate,
    puzzleNumber: publicPuzzle.puzzleNumber,
    currentPitchIndex: input.currentPitchIndex,
    gameState: input.gameState,
    atBatState: input.atBatState,
    pendingAdvance: input.pendingAdvance,
  };

  safelyWriteStorage(storage, getDailyStorageKey(publicPuzzle.puzzleDate), JSON.stringify(savedGame));
}

export function clearSavedDailyGame(
  puzzle: DailyPublicPuzzle | DailyPuzzle,
  storage: DailyStorage | null = getBrowserDailyStorage(),
): void {
  if (storage === null) {
    return;
  }

  safelyRemoveStorage(storage, getDailyStorageKey(puzzle.puzzleDate));
}

function toPublicPuzzle(puzzle: DailyPublicPuzzle | DailyPuzzle): DailyPublicPuzzle {
  return {
    ...puzzle,
    pitches: puzzle.pitches.map((pitch) => (
      'initials' in pitch
        ? pitch
        : { pitchNumber: pitch.pitchNumber, initials: pitch.player.initials }
    )),
  };
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

function isSavedDailyGameForPuzzle(
  value: unknown,
  puzzle: DailyPublicPuzzle,
): value is PersistedSavedDailyGame {
  if (!isRecord(value)) {
    return false;
  }

  if (
    (value.schemaVersion !== DAILY_STORAGE_SCHEMA_VERSION && value.schemaVersion !== 1)
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
    && typeof atBatState.revealCount === 'number'
    && typeof atBatState.strikeCount === 'number'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeSavedDailyGame(
  savedGame: PersistedSavedDailyGame,
  publicPuzzle: DailyPublicPuzzle,
): SavedDailyGame | null {
  if (savedGame.schemaVersion === 1 && !isSafeLegacySave(savedGame, publicPuzzle)) {
    return null;
  }

  const legacyAtBatState = savedGame.atBatState as DailyAtBatUiState & {
    revealedHints?: DailyAtBatUiState['revealedHints'];
    reveal?: DailyAtBatUiState['reveal'];
  };
  return {
    ...savedGame,
    schemaVersion: DAILY_STORAGE_SCHEMA_VERSION,
    gameState: {
      ...savedGame.gameState,
      puzzle: publicPuzzle,
      completedPitchLines: savedGame.gameState.completedPitchLines.map(normalizeSharePitchLine),
      shareResult: savedGame.gameState.shareResult === null
        ? null
        : {
            ...savedGame.gameState.shareResult,
            pitchLines: savedGame.gameState.shareResult.pitchLines.map(normalizeSharePitchLine),
          },
    },
    atBatState: {
      ...legacyAtBatState,
      revealedHints: legacyAtBatState.revealedHints ?? [],
      reveal: legacyAtBatState.reveal ?? null,
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

function isSafeLegacySave(
  savedGame: PersistedSavedDailyGame,
  publicPuzzle: DailyPublicPuzzle,
): boolean {
  return isCompletedLegacySave(savedGame, publicPuzzle) || isUnstartedLegacySave(savedGame);
}

function isCompletedLegacySave(
  savedGame: PersistedSavedDailyGame,
  publicPuzzle: DailyPublicPuzzle,
): boolean {
  return savedGame.gameState.status === 'completed'
    || savedGame.gameState.score.completed === true
    || savedGame.currentPitchIndex >= publicPuzzle.pitches.length;
}

function isUnstartedLegacySave(savedGame: PersistedSavedDailyGame): boolean {
  const atBatState = savedGame.atBatState as DailyAtBatUiState & {
    revealedHints?: DailyAtBatUiState['revealedHints'];
    reveal?: DailyAtBatUiState['reveal'];
  };
  const score = savedGame.gameState.score;
  const inning = savedGame.gameState.inning;

  return (
    savedGame.currentPitchIndex === 0
    && savedGame.pendingAdvance === null
    && savedGame.gameState.completedPitchLines.length === 0
    && score.runs === 0
    && score.hits === 0
    && score.outs === 0
    && score.strikeouts === 0
    && score.completed === false
    && inning.outs === 0
    && inning.completedAtBats.length === 0
    && atBatState.revealCount === 0
    && atBatState.strikeCount === 0
    && (atBatState.revealedHints === undefined || atBatState.revealedHints.length === 0)
    && (atBatState.reveal === undefined || atBatState.reveal === null)
    && atBatState.submittedResult === null
  );
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
  return outcome === 'BUNT' || outcome === 'SAC' ? 'BB' : outcome as DailyOutcome;
}

function normalizeLegacyCorrectOutcome(outcome: unknown): Exclude<DailyOutcome, 'K'> {
  return outcome === 'BUNT' || outcome === 'SAC'
    ? 'BB'
    : outcome as Exclude<DailyOutcome, 'K'>;
}
