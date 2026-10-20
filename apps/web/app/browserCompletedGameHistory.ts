import {
  applyDailyOutcomeForRuleset, createDailyPointsSummary, normalizeDailyTerminalAtBat,
  type DailyRulesetEngineState,
} from '@initial-baseball/engine';
import {
  CLASSIC_DAILY_RULESET_VERSION, DEFAULT_DAILY_BASE_STATE, DEFAULT_DAILY_SCORE_SUMMARY,
  type DailyCompletedAtBat,
} from '@initial-baseball/shared';
import {
  DAILY_COMPLETED_RESULT_STORAGE_PREFIX, getDailyCompletedResultStorageKey,
  readStoredDailyCompletedResult,
} from './dailyCompletedResultClient';
import { isArchiveDailyPuzzleId } from './dailyModeStorage';

type ReadOnlyStorage = Pick<Storage, 'length' | 'key' | 'getItem'>;
export type BrowserCompletedGame = {
  key: string;
  puzzleId: string;
  puzzleDate: string;
  puzzleNumber: number;
  mode: 'Daily' | 'Archive' | 'Classic';
  rulesetVersion: string;
  submissionStatus: 'pending' | 'submitted' | 'conflict' | 'rejected';
  score: number;
  maximum: number | null;
  totalAtBats: number;
  atBats: Array<DailyCompletedAtBat & { score: number }>;
};
export type BrowserCompletedGameHistory =
  | { status: 'unavailable' }
  | { status: 'ready'; games: BrowserCompletedGame[]; unreadableRecords: number };

// The existing submission:v1 format is the shipped nine-slot Daily/Classic
// contract, not a guessed length for future Daily or Custom formats.
const LEGACY_SUBMISSION_TOTAL_AT_BATS = 9;

export function readBrowserCompletedGameHistory(storage: ReadOnlyStorage | null): BrowserCompletedGameHistory {
  if (storage === null) return { status: 'unavailable' };
  const games: BrowserCompletedGame[] = [];
  let unreadableRecords = 0;
  try {
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
    for (const key of keys) {
      if (!key?.startsWith(DAILY_COMPLETED_RESULT_STORAGE_PREFIX + ':')) continue;
      const read = readStoredDailyCompletedResult(storage, key);
      if (read.kind === 'missing') continue;
      if (read.kind !== 'valid') { unreadableRecords++; continue; }
      const { submission, status } = read.record;
      let expectedKey: string;
      try { expectedKey = getDailyCompletedResultStorageKey(submission); }
      catch { unreadableRecords++; continue; }
      if (key !== expectedKey
        || !isCalendarDate(submission.puzzleDate) || submission.puzzleNumber < 1) {
        unreadableRecords++; continue;
      }
      const replay = replayCompletedAtBats(submission.completedAtBats, submission.rulesetVersion);
      if (replay === null) { unreadableRecords++; continue; }
      const classic = submission.rulesetVersion === CLASSIC_DAILY_RULESET_VERSION;
      games.push({
        key, puzzleId: submission.puzzleId, puzzleDate: submission.puzzleDate,
        puzzleNumber: submission.puzzleNumber, rulesetVersion: submission.rulesetVersion,
        mode: classic ? 'Classic' : isArchiveDailyPuzzleId(submission.puzzleId) ? 'Archive' : 'Daily',
        submissionStatus: status, score: classic ? replay.state.score.runs : replay.state.points.points,
        maximum: classic ? null : replay.state.points.maximumPoints,
        totalAtBats: replay.state.points.totalAtBats, atBats: replay.atBats,
      });
    }
  } catch { return { status: 'unavailable' }; }
  games.sort((a, b) => b.puzzleDate.localeCompare(a.puzzleDate) || a.key.localeCompare(b.key));
  return { status: 'ready', games, unreadableRecords };
}

function replayCompletedAtBats(
  facts: DailyCompletedAtBat[],
  rulesetVersion: Parameters<typeof createDailyPointsSummary>[0],
): { state: DailyRulesetEngineState; atBats: BrowserCompletedGame['atBats'] } | null {
  const totalAtBats = LEGACY_SUBMISSION_TOTAL_AT_BATS;
  if (facts.length > totalAtBats) return null;
  let state: DailyRulesetEngineState = {
    inning: { inningNumber: 1, outs: 0, maxOuts: 3, bases: { ...DEFAULT_DAILY_BASE_STATE },
      completedAtBats: [], currentAtBat: null },
    score: { ...DEFAULT_DAILY_SCORE_SUMMARY },
    points: createDailyPointsSummary(rulesetVersion, totalAtBats),
  };
  const atBats: BrowserCompletedGame['atBats'] = [];
  for (const [i, fact] of facts.entries()) {
    if (state.points.completed || !fact || typeof fact.initials !== 'string' || !fact.initials.trim()) return null;
    const normalized = normalizeDailyTerminalAtBat(fact, { pitchNumber: i + 1, initials: fact.initials });
    if (!normalized.ok) return null;
    const priorScore = rulesetVersion === CLASSIC_DAILY_RULESET_VERSION ? state.score.runs : state.points.points;
    state = applyDailyOutcomeForRuleset({ ...state, ...normalized.atBat, rulesetVersion, totalAtBats });
    const nextScore = rulesetVersion === CLASSIC_DAILY_RULESET_VERSION ? state.score.runs : state.points.points;
    atBats.push({ ...normalized.atBat, score: nextScore - priorScore });
  }
  return state.points.completed ? { state, atBats } : null;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
