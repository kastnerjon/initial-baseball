import { dailyEligiblePlayers } from '@initial-baseball/baseball-data';
import { createCanonicalDailyLineupCandidates } from './dailyLineupCandidates';
import {
  DAILY_LINEUP_ALGORITHM_VERSION,
  DAILY_REPEAT_WINDOW_DAYS,
  generateDailyLineup,
  type DailyPlayerUsage,
} from './dailyLineupQuality';
import {
  rankPlayersByRecognizability,
  resolveDailyPuzzleOverridePlayers,
  selectCanonicalDailyPlayersForDate,
  type CanonicalDailyPlayerSelection,
  type DailyPuzzleOverrideMap,
  type ResolveCanonicalPlayerId,
} from './dailyPuzzleSelection';

export const DAILY_REVIEWED_DATA_VERSION = 'reviewed-player-data-2026-07-20';
export const DAILY_LINEUP_QUALITY_LAUNCH_DATE = '2026-07-22';

const LEGACY_POOL_SIZES = [250, 250, 1000, 1000, 2500, 2500, 5000, 5000, 5000] as const;

export type ProductionCanonicalDailySelector = (
  date: string,
) => readonly CanonicalDailyPlayerSelection[];

export function createProductionCanonicalDailySelector(
  overrides: DailyPuzzleOverrideMap,
  resolveCanonicalPlayerId: ResolveCanonicalPlayerId,
): ProductionCanonicalDailySelector {
  const candidates = createCanonicalDailyLineupCandidates(
    rankPlayersByRecognizability(dailyEligiblePlayers),
    resolveCanonicalPlayerId,
  );
  const rankedLegacyCandidates = candidates.map(({ canonicalPlayerId, player }) => ({
    canonicalPlayerId,
    player,
  }));
  const usageHistory: DailyPlayerUsage[] = [];
  const generatedLineups = new Map<string, readonly CanonicalDailyPlayerSelection[]>();
  let lastGeneratedDate: string | null = null;
  let historySeeded = false;

  return (date: string): readonly CanonicalDailyPlayerSelection[] => {
    if (date < DAILY_LINEUP_QUALITY_LAUNCH_DATE) {
      return selectCanonicalDailyPlayersForDate(
        date,
        overrides,
        resolveCanonicalPlayerId,
      );
    }

    if (!historySeeded) {
      seedLegacyUsageHistory(
        usageHistory,
        rankedLegacyCandidates,
        overrides,
        resolveCanonicalPlayerId,
      );
      historySeeded = true;
    }

    const cached = generatedLineups.get(date);
    if (cached !== undefined) return cached;

    const startDate = lastGeneratedDate === null
      ? DAILY_LINEUP_QUALITY_LAUNCH_DATE
      : addDays(lastGeneratedDate, 1);

    for (const puzzleDate of enumerateDates(startDate, date)) {
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

      generatedLineups.set(puzzleDate, selections);
      usageHistory.push(...selections.map(({ canonicalPlayerId }) => ({
        canonicalPlayerId,
        dailyDate: puzzleDate,
      })));
      trimUsageHistory(usageHistory, puzzleDate);
      lastGeneratedDate = puzzleDate;
    }

    const selections = generatedLineups.get(date);
    if (selections === undefined) {
      throw new Error(`Could not construct Daily puzzle lineup for ${date}.`);
    }
    return selections;
  };
}

function seedLegacyUsageHistory(
  usageHistory: DailyPlayerUsage[],
  candidates: readonly CanonicalDailyPlayerSelection[],
  overrides: DailyPuzzleOverrideMap,
  resolveCanonicalPlayerId: ResolveCanonicalPlayerId,
): void {
  const firstHistoryDate = addDays(
    DAILY_LINEUP_QUALITY_LAUNCH_DATE,
    -DAILY_REPEAT_WINDOW_DAYS,
  );
  const lastHistoryDate = addDays(DAILY_LINEUP_QUALITY_LAUNCH_DATE, -1);

  for (const puzzleDate of enumerateDates(firstHistoryDate, lastHistoryDate)) {
    const overrideEntries = overrides[puzzleDate];
    const selections = overrideEntries === undefined
      ? selectLegacyCanonicalPlayers(puzzleDate, candidates)
      : resolveCanonicalOverride(
        puzzleDate,
        overrideEntries,
        resolveCanonicalPlayerId,
      );

    usageHistory.push(...selections.map(({ canonicalPlayerId }) => ({
      canonicalPlayerId,
      dailyDate: puzzleDate,
    })));
  }
}

function selectLegacyCanonicalPlayers(
  date: string,
  rankedCandidates: readonly CanonicalDailyPlayerSelection[],
): CanonicalDailyPlayerSelection[] {
  const selected: CanonicalDailyPlayerSelection[] = [];
  const selectedCanonicalIds = new Set<string>();

  for (let index = 0; index < LEGACY_POOL_SIZES.length; index += 1) {
    const poolSize = LEGACY_POOL_SIZES[index] ?? rankedCandidates.length;
    const pool = rankedCandidates.slice(0, Math.min(poolSize, rankedCandidates.length));
    const selection = selectLowestLegacyHash(
      pool,
      selectedCanonicalIds,
      `${date}:${index + 1}`,
    );

    if (selection === null) {
      throw new Error(`Could not reproduce legacy Daily player for at bat ${index + 1} on ${date}.`);
    }

    selected.push(selection);
    selectedCanonicalIds.add(selection.canonicalPlayerId);
  }

  return selected;
}

function selectLowestLegacyHash(
  pool: readonly CanonicalDailyPlayerSelection[],
  selectedCanonicalIds: ReadonlySet<string>,
  seed: string,
): CanonicalDailyPlayerSelection | null {
  let best: CanonicalDailyPlayerSelection | null = null;
  let bestHash = Number.POSITIVE_INFINITY;

  for (const candidate of pool) {
    if (selectedCanonicalIds.has(candidate.canonicalPlayerId)) continue;
    const hash = hashString(`${seed}:${candidate.player.id}`);
    if (
      hash < bestHash
      || (
        hash === bestHash
        && best !== null
        && compareLegacyTieBreak(candidate, best) < 0
      )
    ) {
      best = candidate;
      bestHash = hash;
    }
  }

  return best;
}

function compareLegacyTieBreak(
  left: CanonicalDailyPlayerSelection,
  right: CanonicalDailyPlayerSelection,
): number {
  return left.player.displayName.localeCompare(right.player.displayName)
    || left.player.id.localeCompare(right.player.id);
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

function trimUsageHistory(
  usageHistory: DailyPlayerUsage[],
  currentDate: string,
): void {
  const earliestDate = addDays(currentDate, -DAILY_REPEAT_WINDOW_DAYS);
  while (usageHistory[0] !== undefined && usageHistory[0].dailyDate < earliestDate) {
    usageHistory.shift();
  }
}

function enumerateDates(startDate: string, endDate: string): string[] {
  if (startDate > endDate) return [];
  const dates: string[] = [];
  const cursor = parseDate(startDate);
  const end = parseDate(endDate);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid Daily puzzle date: ${value}.`);
  return date;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
