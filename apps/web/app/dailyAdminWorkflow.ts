import 'server-only';
import { dailyEligiblePlayers } from '@initial-baseball/baseball-data';
import type { CanonicalPlayerReveal } from '@initial-baseball/baseball-data/runtime';
import {
  DAILY_REPEAT_WINDOW_DAYS,
  DAILY_REVIEWED_DATA_VERSION,
  createCanonicalDailyLineupCandidates,
  createDailyEditorialHorizonService,
  createDailyPuzzleEditorialService,
  createProductionCanonicalDailySelector,
  rankPlayersByRecognizability,
  type DailyEditorialHorizonPuzzle,
  type DailyLineupCandidate,
  type DailyPlayerUsage,
  type DailyPuzzleRepository,
  type ProductionCanonicalDailySelector,
} from '@initial-baseball/daily';
import { normalizeGuess, searchCanonicalPlayers } from '@initial-baseball/engine';
import type { Player } from '@initial-baseball/shared';
import { buildDefaultDailyHints, type DefaultDailyHint } from './buildDefaultDailyHints';
import type { DailyAdminLifecycleAction } from './dailyAdminLifecycleActions';
import { createPlayerIdentity } from './dailyPuzzleAdapters';
import { DAILY_PUZZLE_OVERRIDES } from './dailyPuzzleOverrides';
import { getPacificDailyDateString } from './getPacificDailyDateString';
import { getCanonicalRuntime, resolveCanonicalPlayerId } from './serverCanonicalData';

export type { DailyAdminLifecycleAction } from './dailyAdminLifecycleActions';

export interface DailyAdminWorkflowDependencies {
  candidates: readonly DailyLineupCandidate[];
  reviewedDataVersion: string;
  selectProductionLineup: ProductionCanonicalDailySelector;
  getCurrentDailyDate: () => string;
  loadReveal: (canonicalPlayerId: string) => CanonicalPlayerReveal;
}

export type DailyAdminPlayerSearchResult = {
  canonicalPlayerId: string;
  displayName: string;
  yearsPlayedDisplay: string;
  playerType: Player['primaryRole'];
  primaryPosition: string;
  teamsDisplay: string;
  recognizabilityRank: number | null;
  revealReady: boolean;
  requiresYearDisambiguation: boolean;
};

export type DailyAdminPlayerPreview = DailyAdminPlayerSearchResult & {
  initials: string;
  hints: readonly DefaultDailyHint[];
  reveal: CanonicalPlayerReveal;
};

export type DailyAdminWorkflowErrorKind = 'not-future-puzzle' | 'unknown-player';

export class DailyAdminWorkflowError extends Error {
  constructor(
    public readonly kind: DailyAdminWorkflowErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'DailyAdminWorkflowError';
  }
}

export interface DailyAdminWorkflow {
  getHorizon(startDate?: string): Promise<readonly DailyEditorialHorizonPuzzle[]>;
  ensureHorizon(input: {
    actorId: string;
    occurredAt: string;
    startDate?: string;
  }): Promise<readonly DailyEditorialHorizonPuzzle[]>;
  searchPlayers(query: string): readonly DailyAdminPlayerSearchResult[];
  previewPlayer(canonicalPlayerId: string): DailyAdminPlayerPreview | null;
  replaceSelection(input: {
    puzzleDate: string;
    slot: number;
    canonicalPlayerId: string;
    actorId: string;
    occurredAt: string;
  }): Promise<DailyEditorialHorizonPuzzle>;
  transitionLifecycle(input: {
    puzzleDate: string;
    action: DailyAdminLifecycleAction;
    actorId: string;
    occurredAt: string;
  }): Promise<DailyEditorialHorizonPuzzle>;
}

let defaultDependencies: DailyAdminWorkflowDependencies | null = null;

export function createDailyAdminWorkflow(
  repository: DailyPuzzleRepository,
  dependencies?: DailyAdminWorkflowDependencies,
): DailyAdminWorkflow {
  const resolvedDependencies = dependencies ?? getDefaultDependencies();
  const horizonService = createDailyEditorialHorizonService(repository);
  const editorialService = createDailyPuzzleEditorialService(repository);
  const candidatesById = new Map(
    resolvedDependencies.candidates.map(candidate => [candidate.canonicalPlayerId, candidate]),
  );
  const visibleNameCounts = countVisibleNames(resolvedDependencies.candidates);
  const searchCandidates = resolvedDependencies.candidates.map(candidate => ({
    id: candidate.canonicalPlayerId,
    displayName: candidate.player.displayName,
    fullName: candidate.player.fullName,
    aliases: candidate.player.aliases,
    primaryPosition: candidate.player.primaryPosition,
    firstYear: candidate.player.firstYear,
    lastYear: candidate.player.lastYear,
    teamsDisplay: candidate.player.teamsDisplay,
    playerType: candidate.player.primaryRole,
  }));

  return {
    async getHorizon(startDate = getDefaultStartDate(resolvedDependencies)) {
      return horizonService.getHorizon({
        startDate,
        candidates: resolvedDependencies.candidates,
        usageHistory: await getUsageHistory(repository, startDate, resolvedDependencies),
      });
    },

    async ensureHorizon({ actorId, occurredAt, startDate = getDefaultStartDate(resolvedDependencies) }) {
      return horizonService.ensureHorizon({
        startDate,
        actorId,
        occurredAt,
        reviewedDataVersion: resolvedDependencies.reviewedDataVersion,
        candidates: resolvedDependencies.candidates,
        usageHistory: await getUsageHistory(repository, startDate, resolvedDependencies),
      });
    },

    searchPlayers(query) {
      return searchCanonicalPlayers(query, searchCandidates).flatMap(result => {
        const candidate = candidatesById.get(result.playerId);
        return candidate === undefined
          ? []
          : [toPlayerSearchResult(candidate, result.requiresYearDisambiguation ?? false)];
      });
    },

    previewPlayer(canonicalPlayerId) {
      const candidate = candidatesById.get(canonicalPlayerId);
      if (candidate === undefined) return null;

      return {
        ...toPlayerSearchResult(
          candidate,
          (visibleNameCounts.get(normalizeGuess(candidate.player.displayName)) ?? 0) > 1,
        ),
        initials: createPlayerIdentity(candidate.player).initials,
        hints: buildDefaultDailyHints(candidate.player),
        reveal: resolvedDependencies.loadReveal(canonicalPlayerId),
      };
    },

    async replaceSelection(input) {
      if (input.puzzleDate <= resolvedDependencies.getCurrentDailyDate()) {
        throw new DailyAdminWorkflowError(
          'not-future-puzzle',
          `Daily puzzle ${input.puzzleDate} is not a future editorial puzzle.`,
        );
      }
      if (!candidatesById.has(input.canonicalPlayerId)) {
        throw new DailyAdminWorkflowError(
          'unknown-player',
          `Canonical Daily candidate ${input.canonicalPlayerId} is unavailable.`,
        );
      }

      return horizonService.replaceSelection({
        ...input,
        candidates: resolvedDependencies.candidates,
        usageHistory: await getUsageHistory(repository, input.puzzleDate, resolvedDependencies),
      });
    },

    async transitionLifecycle(input) {
      const transitionInput = {
        puzzleDate: input.puzzleDate,
        actorId: input.actorId,
        occurredAt: input.occurredAt,
      };

      if (input.action === 'schedule') await editorialService.schedule(transitionInput);
      if (input.action === 'publish') await editorialService.publish(transitionInput);
      if (input.action === 'archive') await editorialService.archive(transitionInput);

      const [puzzle] = await horizonService.getHorizon({
        startDate: input.puzzleDate,
        days: 1,
        candidates: resolvedDependencies.candidates,
        usageHistory: await getUsageHistory(repository, input.puzzleDate, resolvedDependencies),
      });
      if (puzzle === undefined) {
        throw new Error(`Daily puzzle not available for ${input.puzzleDate}.`);
      }
      return puzzle;
    },
  };
}

function getDefaultDependencies(): DailyAdminWorkflowDependencies {
  defaultDependencies ??= {
    candidates: buildCanonicalCandidates(),
    reviewedDataVersion: DAILY_REVIEWED_DATA_VERSION,
    selectProductionLineup: createProductionCanonicalDailySelector(
      DAILY_PUZZLE_OVERRIDES,
      resolveCanonicalPlayerId,
    ),
    getCurrentDailyDate: getPacificDailyDateString,
    loadReveal: canonicalPlayerId => getCanonicalRuntime().getReveal(canonicalPlayerId),
  };
  return defaultDependencies;
}

function buildCanonicalCandidates(): DailyLineupCandidate[] {
  return createCanonicalDailyLineupCandidates(
    rankPlayersByRecognizability(dailyEligiblePlayers),
    resolveCanonicalPlayerId,
  );
}

function toPlayerSearchResult(
  candidate: DailyLineupCandidate,
  requiresYearDisambiguation: boolean,
): DailyAdminPlayerSearchResult {
  return {
    canonicalPlayerId: candidate.canonicalPlayerId,
    displayName: candidate.player.displayName,
    yearsPlayedDisplay: candidate.player.yearsPlayedDisplay,
    playerType: candidate.player.primaryRole,
    primaryPosition: candidate.player.primaryPosition,
    teamsDisplay: candidate.player.teamsDisplay,
    recognizabilityRank: candidate.recognizabilityRank,
    revealReady: candidate.revealReady,
    requiresYearDisambiguation,
  };
}

function countVisibleNames(candidates: readonly DailyLineupCandidate[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    const key = normalizeGuess(candidate.player.displayName);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

async function getUsageHistory(
  repository: DailyPuzzleRepository,
  startDate: string,
  dependencies: DailyAdminWorkflowDependencies,
): Promise<DailyPlayerUsage[]> {
  const historyStartDate = addDays(startDate, -DAILY_REPEAT_WINDOW_DAYS);
  const historyEndDate = addDays(startDate, -1);
  const persistedRecords = await repository.listByDateRange(historyStartDate, historyEndDate);
  const persistedDates = new Set(persistedRecords.map(record => record.puzzleDate));
  const baseline = enumerateDates(historyStartDate, historyEndDate)
    .filter(date => !persistedDates.has(date))
    .flatMap(date => dependencies.selectProductionLineup(date).map(selection => ({
      canonicalPlayerId: selection.canonicalPlayerId,
      dailyDate: date,
    })));
  const persisted = persistedRecords.flatMap(record => record.selections.map(selection => ({
    canonicalPlayerId: selection.canonicalPlayerId,
    dailyDate: record.puzzleDate,
  })));
  return [...baseline, ...persisted];
}

function getDefaultStartDate(dependencies: DailyAdminWorkflowDependencies): string {
  return addDays(dependencies.getCurrentDailyDate(), 1);
}

function enumerateDates(startDate: string, endDate: string): string[] {
  if (startDate > endDate) return [];
  const dates: string[] = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) dates.push(date);
  return dates;
}

function addDays(value: string, days: number): string {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(timestamp)) {
    throw new Error(`Invalid Daily administration date: ${value}.`);
  }
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
