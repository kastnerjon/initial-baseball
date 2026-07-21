import type { DailyPuzzleStatus, Player } from '@initial-baseball/shared';
import {
  generateDailyLineup,
  validateDailyLineup,
  type DailyLineupCandidate,
  type DailyLineupSelection,
  type DailyLineupValidation,
  type DailyPlayerUsage,
} from './dailyLineupQuality';
import {
  createDailyPuzzleEditorialService,
  type DailyEditorialSelection,
  type DailyPuzzleEditorialRecord,
  type DailyPuzzleRepository,
} from './dailyPuzzleLifecycle';
import { getDailyPuzzleNumber } from './dailyPuzzleSelection';

export const DEFAULT_DAILY_EDITORIAL_HORIZON_DAYS = 7;

export type DailyEditorialPlayerReview = {
  canonicalPlayerId: string;
  player: Player;
  recognizabilityRank: number | null;
  revealReady: boolean;
};

export type DailyEditorialHorizonSlot = {
  slot: number;
  source: DailyEditorialSelection['source'];
  player: DailyEditorialPlayerReview | null;
};

export type DailyEditorialHorizonPuzzle = {
  puzzleDate: string;
  puzzleNumber: number;
  status: DailyPuzzleStatus;
  revision: number;
  selections: readonly DailyEditorialHorizonSlot[];
  validation: DailyLineupValidation;
};

export type DailyEditorialHorizonInput = {
  startDate: string;
  actorId: string;
  occurredAt: string;
  reviewedDataVersion: string;
  candidates: readonly DailyLineupCandidate[];
  usageHistory?: readonly DailyPlayerUsage[];
  days?: number;
};

export type DailyEditorialHorizonService = {
  ensureHorizon(input: DailyEditorialHorizonInput): Promise<readonly DailyEditorialHorizonPuzzle[]>;
  getHorizon(input: Omit<DailyEditorialHorizonInput, 'actorId' | 'occurredAt' | 'reviewedDataVersion'>): Promise<readonly DailyEditorialHorizonPuzzle[]>;
};

export function createDailyEditorialHorizonService(
  repository: DailyPuzzleRepository,
): DailyEditorialHorizonService {
  const editorialService = createDailyPuzzleEditorialService(repository);

  return {
    async ensureHorizon(input) {
      const dates = getHorizonDates(input.startDate, input.days);
      const existing = await repository.listByDateRange(dates[0]!, dates.at(-1)!);
      const existingByDate = new Map(existing.map(record => [record.puzzleDate, record]));
      const reservedCanonicalIds = new Set(existing.flatMap(record => (
        record.selections.map(selection => selection.canonicalPlayerId)
      )));
      const usageHistory = [...(input.usageHistory ?? []), ...toUsageHistory(existing)];

      for (const puzzleDate of dates) {
        if (existingByDate.has(puzzleDate)) continue;

        const generated = generateDailyLineup({
          seed: {
            dailyDate: puzzleDate,
            reviewedDataVersion: input.reviewedDataVersion,
          },
          candidates: input.candidates.filter(candidate => !reservedCanonicalIds.has(candidate.canonicalPlayerId)),
          usageHistory,
        });
        const record = await editorialService.createDraft({
          id: `daily-${puzzleDate}-v1`,
          puzzleDate,
          puzzleNumber: getDailyPuzzleNumber(puzzleDate),
          selections: generated.map(toEditorialSelection),
          actorId: input.actorId,
          occurredAt: input.occurredAt,
        });
        existingByDate.set(puzzleDate, record);
        usageHistory.push(...toUsageHistory([record]));
      }

      return dates.map(date => buildHorizonPuzzle(requireRecord(existingByDate, date), input.candidates, usageHistory));
    },

    async getHorizon(input) {
      const dates = getHorizonDates(input.startDate, input.days);
      const records = await repository.listByDateRange(dates[0]!, dates.at(-1)!);
      const recordsByDate = new Map(records.map(record => [record.puzzleDate, record]));
      const usageHistory = [...(input.usageHistory ?? []), ...toUsageHistory(records)];
      return dates.flatMap((date) => {
        const record = recordsByDate.get(date);
        return record === undefined ? [] : [buildHorizonPuzzle(record, input.candidates, usageHistory)];
      });
    },
  };
}

function buildHorizonPuzzle(
  record: DailyPuzzleEditorialRecord,
  candidates: readonly DailyLineupCandidate[],
  usageHistory: readonly DailyPlayerUsage[],
): DailyEditorialHorizonPuzzle {
  const candidatesById = new Map(candidates.map(candidate => [candidate.canonicalPlayerId, candidate]));
  const selections = record.selections.map((selection): DailyEditorialHorizonSlot => {
    const candidate = candidatesById.get(selection.canonicalPlayerId);
    return {
      slot: selection.slot,
      source: selection.source,
      player: candidate === undefined ? null : {
        canonicalPlayerId: candidate.canonicalPlayerId,
        player: candidate.player,
        recognizabilityRank: candidate.recognizabilityRank,
        revealReady: candidate.revealReady,
      },
    };
  });

  const validationSelections: DailyLineupSelection[] = record.selections.map(selection => {
    const candidate = candidatesById.get(selection.canonicalPlayerId);
    return {
      slot: selection.slot,
      source: selection.source,
      canonicalPlayerId: selection.canonicalPlayerId,
      player: candidate?.player ?? createMissingPlayer(selection.canonicalPlayerId),
      recognizabilityRank: candidate?.recognizabilityRank ?? null,
      revealReady: candidate?.revealReady ?? false,
    };
  });

  return {
    puzzleDate: record.puzzleDate,
    puzzleNumber: record.puzzleNumber,
    status: record.status,
    revision: record.revision,
    selections,
    validation: validateDailyLineup(record.puzzleDate, validationSelections, usageHistory),
  };
}

function toEditorialSelection(selection: DailyLineupSelection): DailyEditorialSelection {
  return {
    slot: selection.slot,
    canonicalPlayerId: selection.canonicalPlayerId,
    source: selection.source,
  };
}

function toUsageHistory(records: readonly DailyPuzzleEditorialRecord[]): DailyPlayerUsage[] {
  return records.flatMap(record => record.selections.map(selection => ({
    canonicalPlayerId: selection.canonicalPlayerId,
    dailyDate: record.puzzleDate,
  })));
}

function getHorizonDates(startDate: string, days = DEFAULT_DAILY_EDITORIAL_HORIZON_DAYS): string[] {
  if (!Number.isInteger(days) || days < 1) throw new Error(`Editorial horizon days must be a positive integer; received ${days}.`);
  const start = parseCalendarDate(startDate);
  return Array.from({ length: days }, (_, index) => new Date(start + index * 86400000).toISOString().slice(0, 10));
}

function parseCalendarDate(value: string): number {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid Daily editorial horizon date: ${value}.`);
  }
  return timestamp;
}

function requireRecord(records: Map<string, DailyPuzzleEditorialRecord>, date: string): DailyPuzzleEditorialRecord {
  const record = records.get(date);
  if (record === undefined) throw new Error(`Daily puzzle not available for ${date}.`);
  return record;
}

function createMissingPlayer(canonicalPlayerId: string): Player {
  return {
    id: canonicalPlayerId,
    fullName: canonicalPlayerId,
    displayName: canonicalPlayerId,
    primaryRole: 'hitter',
    primaryPosition: 'Unknown',
    mainDecade: '',
    firstYear: null,
    lastYear: null,
    yearsPlayedDisplay: '',
    primaryTeam: '',
    teamsDisplay: '',
    statsLine: '',
    careerStats: null,
    dailyEligibilityTier: 'none',
    dailyEligible: false,
    aliases: [],
  };
}
