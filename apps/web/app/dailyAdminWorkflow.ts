import 'server-only';
import { dailyEligiblePlayers } from '@initial-baseball/baseball-data';
import {
  DAILY_REPEAT_WINDOW_DAYS,
  DAILY_REVIEWED_DATA_VERSION,
  createCanonicalDailyLineupCandidates,
  createDailyEditorialHorizonService,
  createProductionCanonicalDailySelector,
  rankPlayersByRecognizability,
  type DailyEditorialHorizonPuzzle,
  type DailyLineupCandidate,
  type DailyPlayerUsage,
  type DailyPuzzleRepository,
  type ProductionCanonicalDailySelector,
} from '@initial-baseball/daily';
import { DAILY_PUZZLE_OVERRIDES } from './dailyPuzzleOverrides';
import { getPacificDailyDateString } from './getPacificDailyDateString';
import { resolveCanonicalPlayerId } from './serverCanonicalData';

export interface DailyAdminWorkflowDependencies {
  candidates: readonly DailyLineupCandidate[];
  reviewedDataVersion: string;
  selectProductionLineup: ProductionCanonicalDailySelector;
  getCurrentDailyDate: () => string;
}

export interface DailyAdminWorkflow {
  getHorizon(startDate?: string): Promise<readonly DailyEditorialHorizonPuzzle[]>;
  ensureHorizon(input: {
    actorId: string;
    occurredAt: string;
    startDate?: string;
  }): Promise<readonly DailyEditorialHorizonPuzzle[]>;
}

const DEFAULT_DEPENDENCIES: DailyAdminWorkflowDependencies = {
  candidates: buildCanonicalCandidates(),
  reviewedDataVersion: DAILY_REVIEWED_DATA_VERSION,
  selectProductionLineup: createProductionCanonicalDailySelector(
    DAILY_PUZZLE_OVERRIDES,
    resolveCanonicalPlayerId,
  ),
  getCurrentDailyDate: getPacificDailyDateString,
};

export function createDailyAdminWorkflow(
  repository: DailyPuzzleRepository,
  dependencies: DailyAdminWorkflowDependencies = DEFAULT_DEPENDENCIES,
): DailyAdminWorkflow {
  const horizonService = createDailyEditorialHorizonService(repository);

  return {
    async getHorizon(startDate = getDefaultStartDate(dependencies)) {
      return horizonService.getHorizon({
        startDate,
        candidates: dependencies.candidates,
        usageHistory: await getUsageHistory(repository, startDate, dependencies),
      });
    },

    async ensureHorizon({ actorId, occurredAt, startDate = getDefaultStartDate(dependencies) }) {
      return horizonService.ensureHorizon({
        startDate,
        actorId,
        occurredAt,
        reviewedDataVersion: dependencies.reviewedDataVersion,
        candidates: dependencies.candidates,
        usageHistory: await getUsageHistory(repository, startDate, dependencies),
      });
    },
  };
}

function buildCanonicalCandidates(): DailyLineupCandidate[] {
  return createCanonicalDailyLineupCandidates(
    rankPlayersByRecognizability(dailyEligiblePlayers),
    resolveCanonicalPlayerId,
  );
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
