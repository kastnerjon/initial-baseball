'use client';
import type { DailyPublicPuzzle } from '@initial-baseball/shared';
export type DailyNineLeaderboardView = {
  totalEntries: number;
  leaders: Array<{ displayName: string; points: number; rank: number }>;
  ownEntry: { displayName: string; points: number; rank: number } | null;
};
const PATH = '/api/daily/leaderboard';
export async function readDailyNineLeaderboard(
  puzzle: Pick<DailyPublicPuzzle, 'id' | 'puzzleDate' | 'puzzleNumber'>,
  signal: AbortSignal,
): Promise<DailyNineLeaderboardView> {
  const search = new URLSearchParams({
    puzzleId: puzzle.id, date: puzzle.puzzleDate,
    number: String(puzzle.puzzleNumber), ruleset: 'points-v4',
  });
  return readResponse(await fetch(PATH + '?' + search, { signal, headers: { 'cache-control': 'no-store' } }));
}
export async function readOwnDailyNineLeaderboardRank(
  submissionId: string, signal: AbortSignal,
): Promise<DailyNineLeaderboardView> {
  return post({ action: 'rank', submissionId }, signal);
}
export async function submitDailyNineLeaderboardName(
  submissionId: string, displayName: string,
): Promise<DailyNineLeaderboardView> {
  return post({ action: 'submit', submissionId, displayName });
}
async function post(payload: unknown, signal?: AbortSignal): Promise<DailyNineLeaderboardView> {
  return readResponse(await fetch(PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    ...(signal === undefined ? {} : { signal }),
  }));
}
async function readResponse(response: Response): Promise<DailyNineLeaderboardView> {
  if (!response.ok) throw new Error('Leaderboard response unavailable.');
  return decodeDailyNineLeaderboard(await response.json() as unknown);
}
export function decodeDailyNineLeaderboard(value: unknown): DailyNineLeaderboardView {
  if (!record(value) || !Number.isSafeInteger(value.totalEntries)
    || (value.totalEntries as number) < 0 || !Array.isArray(value.leaders)
    || value.leaders.length > 10) throw new Error('Invalid leaderboard response.');
  const totalEntries = value.totalEntries as number;
  const leaders = value.leaders.map((row: unknown) => decodeEntry(row, totalEntries));
  const ownEntry = value.ownEntry === null ? null : decodeEntry(value.ownEntry, totalEntries);
  return { totalEntries, leaders, ownEntry };
}
function decodeEntry(value: unknown, totalEntries: number) {
  if (!record(value) || typeof value.displayName !== 'string'
    || value.displayName.length < 1 || value.displayName.length > 32
    || typeof value.points !== 'number' || !Number.isFinite(value.points)
    || value.points < 0 || value.points > 36 || !Number.isSafeInteger(value.points * 2)
    || !Number.isSafeInteger(value.rank) || (value.rank as number) < 1
    || (value.rank as number) > totalEntries) throw new Error('Invalid leaderboard entry.');
  return { displayName: value.displayName, points: value.points, rank: value.rank as number };
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
