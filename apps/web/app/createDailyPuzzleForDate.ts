import {
  coreDailyEligiblePlayers,
} from '@initial-baseball/baseball-data';
import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyPuzzle,
} from '@initial-baseball/shared';
import { createDailyPuzzlePitch } from './mockDailyPuzzle';

export const DAILY_PUZZLE_EPOCH = '2026-04-27';
const DAILY_PITCH_COUNT = 6;

export function createDailyPuzzleForDate(date: string): DailyPuzzle {
  const puzzleNumber = getDailyPuzzleNumber(date);
  const selectedPlayers = selectPlayersForDate(date, DAILY_PITCH_COUNT);

  return {
    id: `daily-${date}`,
    puzzleNumber,
    puzzleDate: date,
    status: 'published',
    hintConfig: DEFAULT_DAILY_HINT_CONFIG,
    statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches: selectedPlayers.map((player, index) => createDailyPuzzlePitch(index + 1, player)),
  };
}

export function getDailyPuzzleNumber(date: string): number {
  return getDaysSinceEpoch(DAILY_PUZZLE_EPOCH, date) + 1;
}

function selectPlayersForDate(date: string, count: number) {
  if (coreDailyEligiblePlayers.length < count) {
    throw new Error(`Not enough core Daily-eligible players to build a ${count}-pitch puzzle.`);
  }

  return [...coreDailyEligiblePlayers]
    .sort((left, right) => (
      compareHashedValues(`${date}:${left.id}`, `${date}:${right.id}`)
      || left.displayName.localeCompare(right.displayName)
      || left.id.localeCompare(right.id)
    ))
    .slice(0, count);
}

function compareHashedValues(left: string, right: string): number {
  return hashString(left) - hashString(right);
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function getDaysSinceEpoch(epochDate: string, targetDate: string): number {
  return Math.floor((parseUtcDate(targetDate).getTime() - parseUtcDate(epochDate).getTime()) / 86400000);
}

function parseUtcDate(value: string): Date {
  const parts = value.split('-');
  const year = Number.parseInt(parts[0] ?? '', 10);
  const month = Number.parseInt(parts[1] ?? '', 10);
  const day = Number.parseInt(parts[2] ?? '', 10);

  if ([year, month, day].some((part) => Number.isNaN(part))) {
    throw new Error(`Invalid Daily puzzle date: ${value}`);
  }

  return new Date(Date.UTC(year, month - 1, day));
}
