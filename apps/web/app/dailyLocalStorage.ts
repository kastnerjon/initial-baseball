import { createDailyPointsSummary, getDailyAtBatPoints } from '@initial-baseball/engine';
import {
  CURRENT_DAILY_RULESET_VERSION,
  LEGACY_DAILY_RULESET_VERSION,
  isDailyRulesetVersion,
  type DailyCompletedAtBat,
  type DailyGameState,
  type DailyGuessResult,
  type DailyOutcome,
  type DailyPublicPuzzle,
  type DailyPuzzle,
  type DailyRevealCount,
  type DailyRulesetVersion,
  type DailySharePitchLine,
  type DailyShareResult,
} from '@initial-baseball/shared';
import { restoreDailyScorecardAnswers, type DailyScorecardAnswers } from './dailyScorecard';
import type { PendingAtBatAdvance } from './dailyAtBatResolution';
import { isNativeCompletedAtBatList } from './dailyCompletedAtBatProvenance';
import type { DailyAtBatUiState } from './dailyClientState';

const DAILY_STORAGE_PREFIX = 'initial-baseball:daily';
const DAILY_STORAGE_SCHEMA_VERSION = 3;
const MAX_TOKEN_LENGTH = 4096;

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
  progressionToken: string;
  scorecardAnswers?: DailyScorecardAnswers;
};

type PersistedSavedDailyGame = Omit<SavedDailyGame, 'schemaVersion' | 'progressionToken'> & {
  schemaVersion: 1 | 2 | typeof DAILY_STORAGE_SCHEMA_VERSION;
  progressionToken?: unknown;
};

export type LoadedSavedDailyGame = {
  savedGame: SavedDailyGame;
  completedAtBatFactsAreNative: boolean;
};

export type SaveDailyGameInput = {
  currentPitchIndex: number;
  gameState: DailyGameState;
  atBatState: DailyAtBatUiState;
  pendingAdvance: PendingAtBatAdvance | null;
  progressionToken: string;
  scorecardAnswers?: DailyScorecardAnswers;
};

export function getDailyStorageKey(puzzleDate: string): string {
  return `${DAILY_STORAGE_PREFIX}:${puzzleDate}`;
}

export function hasPersistedDailyGameValue(
  puzzleDate: string,
  storage: Pick<Storage, 'getItem'> | null = getBrowserDailyStorage(),
): boolean {
  if (storage === null) return false;
  return safelyReadStorage(storage, getDailyStorageKey(puzzleDate)) !== null;
}

export function loadSavedDailyGame(
  puzzle: DailyPublicPuzzle | DailyPuzzle,
  initialProgressionToken: string,
  storage: DailyStorage | null = getBrowserDailyStorage(),
): SavedDailyGame | null {
  return loadSavedDailyGameWithProvenance(puzzle, initialProgressionToken, storage)?.savedGame ?? null;
}

export function loadSavedDailyGameWithProvenance(
  puzzle: DailyPublicPuzzle | DailyPuzzle,
  initialProgressionToken: string,
  storage: DailyStorage | null = getBrowserDailyStorage(),
): LoadedSavedDailyGame | null {
  if (storage === null) return null;

  const publicPuzzle = toPublicPuzzle(puzzle);
  const savedValue = safelyReadStorage(storage, getDailyStorageKey(publicPuzzle.puzzleDate));
  if (savedValue === null) return null;

  const parsedValue = parseSavedValue(savedValue);
  if (!isSavedDailyGameForPuzzle(parsedValue, publicPuzzle)) return null;

  const savedGame = normalizeSavedDailyGame(parsedValue, publicPuzzle, initialProgressionToken);
  if (savedGame === null) return null;

  return {
    savedGame,
    completedAtBatFactsAreNative: parsedValue.schemaVersion === DAILY_STORAGE_SCHEMA_VERSION
      && isNativeCompletedAtBatList(
        parsedValue.gameState.completedAtBats,
        parsedValue.gameState.completedPitchLines,
      )
      && (
        parsedValue.pendingAdvance === null
        || isNativeCompletedAtBatList(
          parsedValue.pendingAdvance.completedAtBats,
          parsedValue.pendingAdvance.pitchLines,
        )
      ),
  };
}

export function saveDailyGame(
  puzzle: DailyPublicPuzzle | DailyPuzzle,
  input: SaveDailyGameInput,
  storage: DailyStorage | null = getBrowserDailyStorage(),
): boolean {
  if (storage === null) {
    return false;
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
  if (storage === null) {
    return false;
  }
  return safelyRemoveStorage(storage, getDailyStorageKey(puzzle.puzzleDate));
}

function toPublicPuzzle(puzzle: DailyPublicPuzzle | DailyPuzzle): DailyPublicPuzzle {
  return {
    ...puzzle,
    pitches: puzzle.pitches.map(pitch => (
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

function safelyReadStorage(storage: Pick<Storage, 'getItem'>, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
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
    (value.schemaVersion !== DAILY_STORAGE_SCHEMA_VERSION && value.schemaVersion !== 2 && value.schemaVersion !== 1)
    || value.puzzleId !== puzzle.id
    || value.puzzleDate !== puzzle.puzzleDate
    || value.puzzleNumber !== puzzle.puzzleNumber
    || typeof value.currentPitchIndex !== 'number'
    || !isRecord(value.gameState)
    || !isRecord(value.atBatState)
    || !(isRecord(value.pendingAdvance) || value.pendingAdvance === null)
    || (value.schemaVersion === DAILY_STORAGE_SCHEMA_VERSION && !isValidProgressionToken(value.progressionToken))
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

function normalizeSavedDailyGame(
  savedGame: PersistedSavedDailyGame,
  publicPuzzle: DailyPublicPuzzle,
  initialProgressionToken: string,
): SavedDailyGame | null {
  if (savedGame.schemaVersion < DAILY_STORAGE_SCHEMA_VERSION && !isSafePreTokenSave(savedGame, publicPuzzle)) {
    return null;
  }

  const legacyAtBatState = savedGame.atBatState as DailyAtBatUiState & {
    revealedHints?: DailyAtBatUiState['revealedHints'];
    reveal?: DailyAtBatUiState['reveal'];
  };
  const pitchLines = savedGame.gameState.completedPitchLines.map(normalizeSharePitchLine);
  const rulesetVersion = normalizeRulesetVersion(
    savedGame.gameState.rulesetVersion,
    savedGame.gameState.score.completed,
    savedGame.schemaVersion,
  );
  const completedAtBats = normalizeCompletedAtBats(savedGame.gameState.completedAtBats, pitchLines);
  const points = buildNormalizedPoints(
    rulesetVersion,
    publicPuzzle.pitches.length,
    completedAtBats,
    savedGame.gameState.score.completed,
  );

  const pendingAdvance = savedGame.pendingAdvance === null
    ? null
    : normalizePendingAdvance(savedGame.pendingAdvance, rulesetVersion, publicPuzzle.pitches.length);
  return {
    ...savedGame,
    scorecardAnswers: restoreDailyScorecardAnswers(
      savedGame.scorecardAnswers,
      (pendingAdvance?.completedAtBats ?? completedAtBats).map(atBat => atBat.pitchNumber),
    ),
    schemaVersion: DAILY_STORAGE_SCHEMA_VERSION,
    progressionToken: savedGame.schemaVersion === DAILY_STORAGE_SCHEMA_VERSION
      ? savedGame.progressionToken as string
      : initialProgressionToken,
    gameState: {
      ...savedGame.gameState,
      rulesetVersion,
      puzzle: publicPuzzle,
      points,
      completedAtBats,
      completedPitchLines: pitchLines,
      shareResult: normalizeShareResult(savedGame.gameState.shareResult, rulesetVersion, points),
    },
    atBatState: {
      ...legacyAtBatState,
      revealedHints: legacyAtBatState.revealedHints ?? [],
      reveal: legacyAtBatState.reveal ?? null,
      submittedResult: normalizeDailyGuessResult(savedGame.atBatState.submittedResult),
    },
    pendingAdvance,
  };
}

function normalizePendingAdvance(
  pendingAdvance: PendingAtBatAdvance,
  rulesetVersion: DailyRulesetVersion,
  totalAtBats: number,
): PendingAtBatAdvance {
  const pitchLines = pendingAdvance.pitchLines.map(normalizeSharePitchLine);
  const completedAtBats = normalizeCompletedAtBats(pendingAdvance.completedAtBats, pitchLines);
  return {
    ...pendingAdvance,
    points: buildNormalizedPoints(
      rulesetVersion,
      totalAtBats,
      completedAtBats,
      pendingAdvance.score.completed,
    ),
    completedAtBats,
    pitchLines,
  };
}

function normalizeShareResult(
  shareResult: DailyShareResult | null,
  rulesetVersion: DailyRulesetVersion,
  points: DailyGameState['points'],
): DailyShareResult | null {
  if (shareResult === null) {
    return null;
  }
  return {
    ...shareResult,
    rulesetVersion,
    points,
    pitchLines: shareResult.pitchLines.map(normalizeSharePitchLine),
  };
}

function normalizeRulesetVersion(
  value: unknown,
  completed: boolean,
  schemaVersion: PersistedSavedDailyGame['schemaVersion'],
): DailyRulesetVersion {
  if (isDailyRulesetVersion(value)) {
    return value;
  }
  if (completed || schemaVersion === DAILY_STORAGE_SCHEMA_VERSION) {
    return LEGACY_DAILY_RULESET_VERSION;
  }
  return CURRENT_DAILY_RULESET_VERSION;
}

function normalizeCompletedAtBats(
  value: unknown,
  pitchLines: DailySharePitchLine[],
): DailyCompletedAtBat[] {
  if (isNativeCompletedAtBatList(value, pitchLines)) {
    return value.map(atBat => ({ ...atBat }));
  }
  return pitchLines.map((line, index) => deriveLegacyCompletedAtBat(line, index + 1));
}

function deriveLegacyCompletedAtBat(
  line: DailySharePitchLine,
  pitchNumber: number,
): DailyCompletedAtBat {
  return {
    pitchNumber,
    initials: line.initials,
    outcome: line.outcome,
    hintsRevealed: revealCountForOutcome(line.outcome),
    wrongGuesses: line.outcome === 'K' ? 3 : 0,
    resolution: line.outcome === 'K' ? 'strikeout' : 'correct',
  };
}

function buildNormalizedPoints(
  rulesetVersion: DailyRulesetVersion,
  totalAtBats: number,
  completedAtBats: DailyCompletedAtBat[],
  scoreCompleted: boolean,
): DailyGameState['points'] {
  const base = createDailyPointsSummary(rulesetVersion, totalAtBats);
  const atBatsCompleted = Math.min(completedAtBats.length, totalAtBats);
  return {
    ...base,
    points: completedAtBats.reduce(
      (total, atBat) => total + getDailyAtBatPoints({
        rulesetVersion,
        outcome: atBat.outcome,
        hintsRevealed: atBat.hintsRevealed,
        wrongGuesses: atBat.wrongGuesses,
      }),
      0,
    ),
    atBatsCompleted,
    completed: scoreCompleted || atBatsCompleted >= totalAtBats,
  };
}

function revealCountForOutcome(outcome: DailyOutcome): DailyRevealCount {
  switch (outcome) {
    case 'HR': return 0;
    case '3B': return 1;
    case '2B': return 2;
    case '1B': return 3;
    case 'BB': return 4;
    case 'K': return 0;
  }
}

function isSafePreTokenSave(
  savedGame: PersistedSavedDailyGame,
  publicPuzzle: DailyPublicPuzzle,
): boolean {
  return isCompletedPreTokenSave(savedGame, publicPuzzle)
    || isUntouchedPreTokenStart(savedGame);
}

function isCompletedPreTokenSave(
  savedGame: PersistedSavedDailyGame,
  publicPuzzle: DailyPublicPuzzle,
): boolean {
  return savedGame.gameState.status === 'completed'
    || savedGame.gameState.score.completed === true
    || savedGame.currentPitchIndex >= publicPuzzle.pitches.length;
}

function isUntouchedPreTokenStart(savedGame: PersistedSavedDailyGame): boolean {
  const atBatState = savedGame.atBatState as DailyAtBatUiState & {
    revealedHints?: DailyAtBatUiState['revealedHints'];
    reveal?: DailyAtBatUiState['reveal'];
  };

  return (
    savedGame.currentPitchIndex === 0
    && savedGame.pendingAdvance === null
    && savedGame.gameState.status !== 'completed'
    && savedGame.gameState.score.completed === false
    && savedGame.gameState.shareResult === null
    && savedGame.gameState.completedPitchLines.length === 0
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

function isValidProgressionToken(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_TOKEN_LENGTH;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
