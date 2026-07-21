import { dailyEligiblePlayers } from '@initial-baseball/baseball-data';
import type { Player } from '@initial-baseball/shared';
import {
  DAILY_LINEUP_ALGORITHM_VERSION,
  generateDailyLineup,
  type DailyLineupCandidate,
  type DailyPlayerUsage,
} from './dailyLineupQuality';
import {
  DAILY_PUZZLE_EPOCH,
  rankPlayersByRecognizability,
  resolveDailyPuzzleOverridePlayers,
  type CanonicalDailyPlayerSelection,
  type DailyPuzzleOverrideMap,
  type ResolveCanonicalPlayerId,
} from './dailyPuzzleSelection';

export const DAILY_REVIEWED_DATA_VERSION = 'reviewed-player-data-2026-07-20';

export function selectProductionCanonicalDailyPlayersForDate(
  date: string,
  overrides: DailyPuzzleOverrideMap,
  resolveCanonicalPlayerId: ResolveCanonicalPlayerId,
): CanonicalDailyPlayerSelection[] {
  if (date < DAILY_PUZZLE_EPOCH) {
    throw new Error(`Daily puzzle date ${date} precedes the supported epoch ${DAILY_PUZZLE_EPOCH}.`);
  }

  const candidates = buildCanonicalCandidates(resolveCanonicalPlayerId);
  const usageHistory: DailyPlayerUsage[] = [];
  let targetSelections: CanonicalDailyPlayerSelection[] | null = null;

  for (const puzzleDate of enumerateDates(DAILY_PUZZLE_EPOCH, date)) {
    const overrideEntries = overrides[puzzleDate];
    const selections = overrideEntries === undefined
      ? generateDailyLineup({
        seed: {
          dailyDate: puzzleDate,
          reviewedDataVersion: DAILY_REVIEWED_DATA_VERSION,
          algorithmVersion: DAILY_LINEUP_ALGORITHM_VERSION,
        },
        candidates,
        usageHistory,
      }).map(({ canonicalPlayerId, player }) => ({ canonicalPlayerId, player }))
      : resolveCanonicalOverride(
        puzzleDate,
        overrideEntries,
        resolveCanonicalPlayerId,
      );

    usageHistory.push(...selections.map(({ canonicalPlayerId }) => ({
      canonicalPlayerId,
      dailyDate: puzzleDate,
    })));

    if (puzzleDate === date) targetSelections = selections;
  }

  if (targetSelections === null) {
    throw new Error(`Could not construct Daily puzzle lineup for ${date}.`);
  }

  return targetSelections;
}

function buildCanonicalCandidates(
  resolveCanonicalPlayerId: ResolveCanonicalPlayerId,
): DailyLineupCandidate[] {
  const rankedPlayers = rankPlayersByRecognizability(dailyEligiblePlayers);
  const candidatesByCanonicalId = new Map<string, DailyLineupCandidate>();

  rankedPlayers.forEach((player, index) => {
    const canonicalPlayerId = resolveCanonicalPlayerId(player.id);
    if (canonicalPlayerId === null || candidatesByCanonicalId.has(canonicalPlayerId)) return;

    candidatesByCanonicalId.set(canonicalPlayerId, {
      canonicalPlayerId,
      player,
      recognizabilityRank: index + 1,
      revealReady: isRevealReady(player),
    });
  });

  return [...candidatesByCanonicalId.values()];
}

function resolveCanonicalOverride(
  date: string,
  overrideEntries: DailyPuzzleOverrideMap[string],
  resolveCanonicalPlayerId: ResolveCanonicalPlayerId,
): CanonicalDailyPlayerSelection[] {
  const selections = resolveDailyPuzzleOverridePlayers(date, overrideEntries).map(player => ({
    player,
    canonicalPlayerId: requireCanonicalPlayerId(date, player.id, resolveCanonicalPlayerId),
  }));
  const canonicalIds = selections.map(selection => selection.canonicalPlayerId);

  if (new Set(canonicalIds).size !== canonicalIds.length) {
    throw new Error(`Daily puzzle override for ${date} resolves duplicate canonical players.`);
  }

  return selections;
}

function requireCanonicalPlayerId(
  date: string,
  playerId: string,
  resolveCanonicalPlayerId: ResolveCanonicalPlayerId,
): string {
  const canonicalPlayerId = resolveCanonicalPlayerId(playerId);
  if (canonicalPlayerId === null) {
    throw new Error(
      `Daily puzzle for ${date} could not resolve legacy playerId to canonical runtime data: ${playerId}.`,
    );
  }
  return canonicalPlayerId;
}

function isRevealReady(player: Player): boolean {
  return player.displayName.trim().length > 0
    && player.primaryPosition.trim().length > 0
    && player.firstYear !== null
    && player.lastYear !== null
    && player.careerStats !== null;
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = parseDate(startDate);
  const end = parseDate(endDate);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function parseDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid Daily puzzle date: ${value}.`);
  return date;
}
