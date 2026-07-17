import {
  baseballPlayers,
  dailyEligiblePlayers,
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
export const DAILY_AT_BAT_COUNT = 9;
const LEGACY_OVERRIDE_COUNT = 6;
const RECOGNIZABILITY_POOL_SIZES = [250, 250, 1000, 1000, 2500, 2500, 5000, 5000, 5000] as const;
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

export function rankPlayersByRecognizability(players: readonly Player[]): Player[] {
  return [...players].sort((left, right) => (
    getRecognizabilityScore(right) - getRecognizabilityScore(left)
    || right.lastYear === null ? 1 : left.lastYear === null ? -1 : right.lastYear - left.lastYear
    || left.displayName.localeCompare(right.displayName)
    || left.id.localeCompare(right.id)
  ));
}

function selectPlayersForDate(date: string, overrides: DailyPuzzleOverrideMap): Player[] {
  const overrideNames = getOverrideNames(date, overrides);

  if (overrideNames !== undefined) {
    return resolveOverridePlayers(date, overrideNames);
  }

  if (dailyEligiblePlayers.length < DAILY_AT_BAT_COUNT) {
    throw new Error(`Not enough Daily-eligible players to build a ${DAILY_AT_BAT_COUNT}-at-bat puzzle.`);
  }

  const rankedPlayers = rankPlayersByRecognizability(dailyEligiblePlayers);
  const selectedPlayers: Player[] = [];
  const selectedIds = new Set<string>();

  for (let index = 0; index < RECOGNIZABILITY_POOL_SIZES.length; index += 1) {
    const poolSize = RECOGNIZABILITY_POOL_SIZES[index] ?? rankedPlayers.length;
    const pool = rankedPlayers.slice(0, Math.min(poolSize, rankedPlayers.length));
    const player = selectDeterministicUnusedPlayer(pool, selectedIds, `${date}:${index + 1}`);

    if (player === null) {
      throw new Error(`Could not select a unique player for at bat ${index + 1}.`);
    }

    selectedPlayers.push(player);
    selectedIds.add(player.id);
  }

  return selectedPlayers;
}

function selectDeterministicUnusedPlayer(
  pool: readonly Player[],
  selectedIds: ReadonlySet<string>,
  seed: string,
): Player | null {
  const rankedByDate = [...pool].sort((left, right) => (
    compareHashedValues(`${seed}:${left.id}`, `${seed}:${right.id}`)
    || left.displayName.localeCompare(right.displayName)
    || left.id.localeCompare(right.id)
  ));

  return rankedByDate.find((player) => !selectedIds.has(player.id)) ?? null;
}

function getRecognizabilityScore(player: Player): number {
  const recencyBonus = player.lastYear === null ? 0 : Math.max(0, player.lastYear - 1940) * 4;
  const longevityBonus = player.firstYear === null || player.lastYear === null
    ? 0
    : Math.max(0, player.lastYear - player.firstYear + 1) * 20;
  const coreBonus = player.dailyEligibilityTier === 'core' ? 5000 : 0;

  if (player.careerStats?.kind === 'pitcher') {
    const { W, K, IP } = player.careerStats.stats;
    const innings = Number.parseFloat(IP === '—' ? '0' : IP);

    return coreBonus
      + recencyBonus
      + longevityBonus
      + (W * 18)
      + (K * 2)
      + (Number.isFinite(innings) ? innings : 0);
  }

  if (player.careerStats?.kind === 'hitter') {
    const { H, HR, R, RBI, SB, OPS } = player.careerStats.stats;
    const ops = Number.parseFloat(OPS === '—' ? '0' : OPS);

    return coreBonus
      + recencyBonus
      + longevityBonus
      + H
      + (HR * 8)
      + R
      + RBI
      + (SB * 2)
      + (Number.isFinite(ops) ? ops * 1000 : 0);
  }

  return coreBonus + recencyBonus + longevityBonus;
}

function getOverrideNames(date: string, overrides: DailyPuzzleOverrideMap): readonly DailyPuzzleOverrideEntry[] | undefined {
  return overrides[date];
}

export function resolveDailyPuzzleOverridePlayers(
  date: string,
  overrideEntries: readonly DailyPuzzleOverrideEntry[],
): Player[] {
  if (overrideEntries.length !== DAILY_AT_BAT_COUNT && overrideEntries.length !== LEGACY_OVERRIDE_COUNT) {
    throw new Error(
      `Daily puzzle override for ${date} must contain exactly ${DAILY_AT_BAT_COUNT} players (${LEGACY_OVERRIDE_COUNT} is accepted for legacy dates).`,
    );
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
