import { POINTS_V4_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { DAILY_STORAGE_SCHEMA_VERSION } from '../dailySavedGameCodec';
import { getDailyModeStorageKey } from '../dailyModeStorage';
import type { IssuedArchiveListEntry } from './ArchiveLocalResults';

type ReadOnlyStorage = Pick<Storage, 'getItem'>;
const ARCHIVE_BETA_LENGTH = 9;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Display-only hint that a specific issued archive puzzle has meaningful local
 * gameplay. This does NOT validate its signed token or establish server progress.
 * The authoritative game page still decodes/validates the full save on resume.
 */
export function readBrowserArchiveSavedProgress(
  storage: ReadOnlyStorage | null,
  puzzles: readonly IssuedArchiveListEntry[],
): ReadonlySet<string> {
  const found = new Set<string>();
  if (storage === null) return found;

  for (const { dailyNumber, puzzleDate } of puzzles) {
    if (!Number.isSafeInteger(dailyNumber) || dailyNumber < 1) continue;
    const puzzleId = 'archive-beta-v1-daily-' + dailyNumber;
    const key = getDailyModeStorageKey(puzzleDate, POINTS_V4_DAILY_RULESET_VERSION, puzzleId);
    try {
      const raw = storage.getItem(key);
      if (raw === null) continue;
      const saved: unknown = JSON.parse(raw);
      if (!isRecord(saved) || saved.schemaVersion !== DAILY_STORAGE_SCHEMA_VERSION
        || saved.puzzleId !== puzzleId || saved.puzzleDate !== puzzleDate
        || saved.puzzleNumber !== dailyNumber
        || !Number.isInteger(saved.currentPitchIndex)
        || (saved.currentPitchIndex as number) < 0
        || (saved.currentPitchIndex as number) >= ARCHIVE_BETA_LENGTH
        || !isRecord(saved.gameState) || !isRecord(saved.gameState.puzzle)
        || saved.gameState.puzzle.id !== puzzleId
        || saved.gameState.puzzle.puzzleDate !== puzzleDate
        || saved.gameState.puzzle.puzzleNumber !== dailyNumber
        || saved.gameState.rulesetVersion !== POINTS_V4_DAILY_RULESET_VERSION
        || saved.gameState.status !== 'in_progress'
        || !isRecord(saved.gameState.score) || saved.gameState.score.completed !== false
        || !isRecord(saved.gameState.points) || saved.gameState.points.completed !== false
        || !Array.isArray(saved.gameState.completedPitchLines)
        || !(saved.pendingAdvance === null
          || (isRecord(saved.pendingAdvance)
            && Number.isInteger(saved.pendingAdvance.nextPitchIndex)
            && (saved.pendingAdvance.nextPitchIndex as number) >= 1
            && (saved.pendingAdvance.nextPitchIndex as number) <= ARCHIVE_BETA_LENGTH
            && Array.isArray(saved.pendingAdvance.pitchLines)
            && isRecord(saved.pendingAdvance.score)))
        || !isRecord(saved.atBatState)
        || !Number.isInteger(saved.atBatState.revealCount)
        || !Number.isInteger(saved.atBatState.strikeCount)
        || (saved.atBatState.revealCount as number) < 0
        || (saved.atBatState.revealCount as number) > 4
        || (saved.atBatState.strikeCount as number) < 0
        || (saved.atBatState.strikeCount as number) > 3
        || typeof saved.progressionToken !== 'string'
        || saved.progressionToken.length < 1 || saved.progressionToken.length > 4096) continue;

      // Opening the page automatically saves an untouched initial state.
      // Do not call that "in progress"; typing a search query alone also
      // doesn't establish a hint, incorrect guess or finished at-bat.
      if ((saved.currentPitchIndex as number) > 0
        || saved.gameState.completedPitchLines.length > 0
        || saved.pendingAdvance !== null
        || (saved.atBatState.revealCount as number) > 0
        || (saved.atBatState.strikeCount as number) > 0) {
        found.add(puzzleId);
      }
    } catch {
      // Treat unavailable or corrupt local state as unknown, not "unplayed".
    }
  }
  return found;
}
