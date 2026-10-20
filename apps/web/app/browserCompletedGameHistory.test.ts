import { describe, expect, it, vi } from 'vitest';
import {
  CLASSIC_DAILY_RULESET_VERSION, POINTS_V3_DAILY_RULESET_VERSION, POINTS_V4_DAILY_RULESET_VERSION,
  type DailyCompletedAtBat, type DailyCompletedResultRulesetVersion,
} from '@initial-baseball/shared';
import {
  createDailyCompletedResultClient, getDailyCompletedResultStorageKey,
} from './dailyCompletedResultClient';
import { readBrowserCompletedGameHistory } from './browserCompletedGameHistory';
import { clearSavedDailyGame, getDailyStorageKey } from './dailyLocalStorage';
import { DEMO_DAILY_PUZZLE } from './mockDailyPuzzle';

const puzzle = DEMO_DAILY_PUZZLE;
const facts: DailyCompletedAtBat[] = Array.from({ length: 9 }, (_, i) => ({
  pitchNumber: i + 1, initials: 'P' + (i + 1), outcome: 'HR',
  hintsRevealed: 0, wrongGuesses: 0, resolution: 'correct',
}));
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data, get length() { return data.size; },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
    removeItem: vi.fn((key: string) => { data.delete(key); }),
  };
}
function record(rulesetVersion: DailyCompletedResultRulesetVersion = POINTS_V4_DAILY_RULESET_VERSION, completedAtBats = facts) {
  return { version: 1, status: 'submitted', submission: {
    schemaVersion: 1, submissionId: 'first-completion', puzzleId: puzzle.id,
    puzzleDate: puzzle.puzzleDate, puzzleNumber: puzzle.puzzleNumber, rulesetVersion, completedAtBats,
  } };
}
function put(storage: ReturnType<typeof memoryStorage>, value = record()) {
  storage.setItem(getDailyCompletedResultStorageKey(value.submission), JSON.stringify(value));
}
function games(storage: ReturnType<typeof memoryStorage>) {
  const result = readBrowserCompletedGameHistory(storage);
  expect(result.status).toBe('ready');
  if (result.status !== 'ready') throw Error('History unavailable');
  return result;
}

describe('read-only completed game history', () => {
  it('uses stored ruleset maxima, not today’s scoring', () => {
    const storage = memoryStorage();
    put(storage, record(POINTS_V3_DAILY_RULESET_VERSION));
    put(storage, record(POINTS_V4_DAILY_RULESET_VERSION));
    expect(games(storage).games.map(g => [g.rulesetVersion, g.score, g.maximum]))
      .toEqual(expect.arrayContaining([
        [POINTS_V3_DAILY_RULESET_VERSION, 63, 63],
        [POINTS_V4_DAILY_RULESET_VERSION, 36, 36],
      ]));
  });

  it('replays Classic early completion as runs, not a points score', () => {
    const storage = memoryStorage();
    const strikeouts: DailyCompletedAtBat[] = facts.slice(0, 3).map(f => ({
      ...f, outcome: 'K', wrongGuesses: 3, resolution: 'strikeout',
    }));
    put(storage, record(CLASSIC_DAILY_RULESET_VERSION, strikeouts));
    expect(games(storage).games[0]).toMatchObject({
      mode: 'Classic', score: 0, maximum: null, totalAtBats: 9,
      atBats: expect.arrayContaining([expect.objectContaining({ outcome: 'K', score: 0 })]),
    });
  });

  it('preserves the first completion through replay and local-game reset', async () => {
    const storage = memoryStorage();
    const request = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    const client = createDailyCompletedResultClient({
      storage, createSubmissionId: () => 'first-completion', submitRequest: request,
    });
    const input = { puzzle, rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION, completedAtBats: facts };
    await client.submitIfNeeded(input, { allowCreate: true });
    storage.setItem(getDailyStorageKey(puzzle.puzzleDate), 'temporary gameplay save');
    clearSavedDailyGame(puzzle, storage);
    await client.submitIfNeeded({ ...input, completedAtBats: [] }, { allowCreate: true });
    expect(games(storage).games[0]?.score).toBe(36);
    expect(games(storage).games[0]?.atBats).toHaveLength(9);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('keeps same-date Daily, Archive and Classic identities separate', () => {
    const storage = memoryStorage();
    put(storage);
    const archive = record(); archive.submission.puzzleId = 'archive-beta-v1-daily-1';
    put(storage, archive);
    put(storage, record(CLASSIC_DAILY_RULESET_VERSION));
    expect(games(storage).games.map(g => g.mode).sort()).toEqual(['Archive', 'Classic', 'Daily']);
    const wrongKey = getDailyCompletedResultStorageKey({ ...record().submission, puzzleId: 'another-puzzle' });
    storage.setItem(wrongKey, JSON.stringify(record()));
    expect(games(storage).games).toHaveLength(3);
    expect(games(storage).unreadableRecords).toBe(1);
  });

  it('does not infer variable length from truncated or overlong legacy facts', () => {
    for (const list of [facts.slice(0, 1), facts.slice(0, 8), [...facts, facts[0]!]]) {
      const storage = memoryStorage(); put(storage, record(POINTS_V4_DAILY_RULESET_VERSION, list));
      expect(games(storage)).toMatchObject({ games: [], unreadableRecords: 1 });
    }
  });

  it('rejects malformed JSON, unknown schema and inconsistent terminal facts without zero scores', () => {
    const storage = memoryStorage();
    const key = getDailyCompletedResultStorageKey(record().submission);
    for (const value of ['{', JSON.stringify({ ...record(), version: 2 }),
      JSON.stringify(record(POINTS_V4_DAILY_RULESET_VERSION, [{ ...facts[0]!, outcome: 'K' }, ...facts.slice(1)])),
      JSON.stringify(record(POINTS_V4_DAILY_RULESET_VERSION, [null as unknown as DailyCompletedAtBat]))]) {
      storage.setItem(key, value);
      expect(games(storage)).toMatchObject({ games: [], unreadableRecords: 1 });
    }
  });

  it('isolates malformed Unicode identity from valid neighboring results', () => {
    const storage = memoryStorage(); put(storage);
    const malformed = record();
    malformed.submission.puzzleId = String.fromCharCode(0xd800);
    storage.setItem('initial-baseball:daily-result-submission:v1:malformed', JSON.stringify(malformed));
    expect(games(storage)).toMatchObject({
      games: [expect.objectContaining({ score: 36 })], unreadableRecords: 1,
    });
  });

  it('whitelists recorded facts and performs no storage writes or network requests', () => {
    const storage = memoryStorage();
    const value = record();
    const contaminated = { ...value, secret: 'UNREVEALED ANSWER', submission: {
      ...value.submission, completedAtBats: facts.map(f => ({ ...f, answer: 'UNREVEALED ANSWER' })),
    } };
    storage.setItem(getDailyCompletedResultStorageKey(value.submission), JSON.stringify(contaminated));
    storage.setItem('initial-baseball:daily:other-game', 'unrelated save');
    storage.setItem('other-app-data', 'private');
    const before = [...storage.data];
    storage.setItem.mockClear(); storage.removeItem.mockClear();
    const result = readBrowserCompletedGameHistory(storage);
    expect(JSON.stringify(result)).not.toContain('UNREVEALED ANSWER');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect([...storage.data]).toEqual(before);
  });

  it('distinguishes missing and unavailable browser history', () => {
    expect(readBrowserCompletedGameHistory(null)).toEqual({ status: 'unavailable' });
    expect(games(memoryStorage())).toEqual({ status: 'ready', games: [], unreadableRecords: 0 });
    const unavailable = { get length(): number { throw Error('Denied'); }, key: () => null, getItem: () => null };
    expect(readBrowserCompletedGameHistory(unavailable)).toEqual({ status: 'unavailable' });
  });
});
