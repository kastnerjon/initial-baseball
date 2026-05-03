import {
  baseballPlayers,
  coreDailyEligiblePlayers,
} from '@initial-baseball/baseball-data';
import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyPuzzle,
} from '@initial-baseball/shared';
import type { Player } from '@initial-baseball/shared';
import { createDailyPuzzlePitch } from './dailyPuzzleAdapters';
import { DAILY_PUZZLE_OVERRIDES, type DailyPuzzleOverrideEntry } from './dailyPuzzleOverrides';

export const DAILY_PUZZLE_EPOCH = '2026-04-27';
const DAILY_PITCH_COUNT = 6;
type DailyPuzzleOverrideMap = Record<string, readonly DailyPuzzleOverrideEntry[]>;

export function createDailyPuzzleForDate(date: string): DailyPuzzle {
  return createDailyPuzzleForDateWithOverrides(date, DAILY_PUZZLE_OVERRIDES);
}

export function createDailyPuzzleForDateWithOverrides(
  date: string,
  overrides: DailyPuzzleOverrideMap,
): DailyPuzzle {
  const puzzleNumber = getDailyPuzzleNumber(date);
  const selectedPlayers = selectPlayersForDate(date, overrides);

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

function selectPlayersForDate(date: string, overrides: DailyPuzzleOverrideMap): Player[] {
  const overrideNames = getOverrideNames(date, overrides);

  if (overrideNames !== undefined) {
    return resolveOverridePlayers(date, overrideNames);
  }

  if (coreDailyEligiblePlayers.length < DAILY_PITCH_COUNT) {
    throw new Error(`Not enough core Daily-eligible players to build a ${DAILY_PITCH_COUNT}-pitch puzzle.`);
  }

  return [...coreDailyEligiblePlayers]
    .sort((left, right) => (
      compareHashedValues(`${date}:${left.id}`, `${date}:${right.id}`)
      || left.displayName.localeCompare(right.displayName)
      || left.id.localeCompare(right.id)
    ))
    .slice(0, DAILY_PITCH_COUNT);
}

function getOverrideNames(date: string, overrides: DailyPuzzleOverrideMap): readonly DailyPuzzleOverrideEntry[] | undefined {
  return overrides[date];
}

export function resolveDailyPuzzleOverridePlayers(
  date: string,
  overrideEntries: readonly DailyPuzzleOverrideEntry[],
): Player[] {
  if (overrideEntries.length !== DAILY_PITCH_COUNT) {
    throw new Error(`Daily puzzle override for ${date} must contain exactly ${DAILY_PITCH_COUNT} players.`);
  }

  const players = overrideEntries.map((entry) => resolveOverridePlayer(date, entry));
  const duplicatePlayer = findFirstDuplicate(players.map((player) => player.id));

  if (duplicatePlayer !== null) {
    throw new Error(`Daily puzzle override for ${date} resolves duplicate player: ${duplicatePlayer}.`);
  }

  return players;
}

function resolveOverridePlayers(date: string, entries: readonly DailyPuzzleOverrideEntry[]): Player[] {
  return resolveDailyPuzzleOverridePlayers(date, entries);
}

function resolveOverridePlayer(date: string, entry: DailyPuzzleOverrideEntry): Player {
  if (typeof entry !== 'string') {
    return resolveOverridePlayerById(date, entry);
  }

  return resolveOverridePlayerByName(date, entry);
}

function resolveOverridePlayerByName(date: string, name: string): Player {
  const matchingPlayers = findExactPlayerMatches(name);

  if (matchingPlayers.length === 0) {
    throw new Error(`Daily puzzle override for ${date} could not resolve player: ${name}.`);
  }

  if (matchingPlayers.length > 1) {
    throw new Error(`Daily puzzle override for ${date} resolved ambiguous player name: ${name}.`);
  }

  const player = matchingPlayers[0];

  if (player === undefined) {
    throw new Error(`Daily puzzle override for ${date} could not resolve player: ${name}.`);
  }

  return player;
}

function resolveOverridePlayerById(
  date: string,
  entry: Exclude<DailyPuzzleOverrideEntry, string>,
): Player {
  const player = baseballPlayers.find((candidate) => candidate.id === entry.playerId);

  if (player === undefined) {
    throw new Error(`Daily puzzle override for ${date} could not resolve playerId: ${entry.playerId}.`);
  }

  if (entry.name !== undefined && !doesPlayerMatchName(player, entry.name)) {
    throw new Error(`Daily puzzle override for ${date} playerId ${entry.playerId} does not match name: ${entry.name}.`);
  }

  return player;
}

function findExactPlayerMatches(name: string): Player[] {
  const fullNameMatches = baseballPlayers.filter((player) => player.fullName === name);

  if (fullNameMatches.length > 0) {
    return fullNameMatches;
  }

  const displayNameMatches = baseballPlayers.filter((player) => player.displayName === name);

  if (displayNameMatches.length > 0) {
    return displayNameMatches;
  }

  return baseballPlayers.filter((player) => player.aliases.includes(name));
}

function doesPlayerMatchName(player: Player, name: string): boolean {
  return player.fullName === name || player.displayName === name || player.aliases.includes(name);
}

function findFirstDuplicate(values: string[]): string | null {
  const seenValues = new Set<string>();

  for (const value of values) {
    if (seenValues.has(value)) {
      return value;
    }

    seenValues.add(value);
  }

  return null;
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
