import type { Player } from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import { createDailyEditorialHorizonService } from './dailyEditorialHorizon';
import { type DailyLineupCandidate } from './dailyLineupQuality';
import {
  createDailyPuzzleDraft,
  scheduleDailyPuzzle,
  type DailyPuzzleEditorialRecord,
  type DailyPuzzleRepository,
  type DailyPuzzleRepositorySaveOptions,
} from './dailyPuzzleLifecycle';
import { getDailyPuzzleNumber } from './dailyPuzzleSelection';

const START_DATE = '2026-08-01';
const OCCURRED_AT = '2026-07-21T14:00:00.000Z';

function buildCandidates(): DailyLineupCandidate[] {
  return [
    ...buildBand(1, 20),
    ...buildBand(251, 20),
    ...buildBand(1001, 20),
    ...buildBand(2501, 30),
  ];
}

function buildBand(startRank: number, count: number): DailyLineupCandidate[] {
  return Array.from({ length: count }, (_, index) => {
    const rank = startRank + index;
    const canonicalPlayerId = `player-${rank}`;
    return {
      canonicalPlayerId,
      player: buildPlayer(canonicalPlayerId),
      recognizabilityRank: rank,
      revealReady: true,
    };
  });
}

function buildPlayer(id: string): Player {
  return {
    id,
    fullName: id,
    displayName: id,
    primaryRole: 'hitter',
    primaryPosition: 'CF',
    mainDecade: '2000s',
    firstYear: 2000,
    lastYear: 2010,
    yearsPlayedDisplay: '2000–2010',
    primaryTeam: 'NYM',
    teamsDisplay: 'NYM',
    statsLine: '',
    careerStats: null,
    dailyEligibilityTier: 'core',
    dailyEligible: true,
    aliases: [],
  };
}

function createInput(candidates = buildCandidates()) {
  return {
    startDate: START_DATE,
    actorId: 'editor-1',
    occurredAt: OCCURRED_AT,
    reviewedDataVersion: 'reviewed-v1',
    candidates,
  };
}

describe('Daily editorial horizon service', () => {
  it('creates and returns seven ordered draft puzzles with validated canonical review data', async () => {
    const repository = new InMemoryDailyPuzzleRepository();
    const horizon = await createDailyEditorialHorizonService(repository).ensureHorizon(createInput());

    expect(horizon).toHaveLength(7);
    expect(horizon.map(puzzle => puzzle.puzzleDate)).toEqual([
      '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04',
      '2026-08-05', '2026-08-06', '2026-08-07',
    ]);
    expect(horizon.every(puzzle => puzzle.status === 'draft')).toBe(true);
    expect(horizon.every(puzzle => puzzle.validation.valid)).toBe(true);
    expect(horizon.every(puzzle => puzzle.selections.length === 9)).toBe(true);
    expect(repository.records).toHaveLength(7);
  });

  it('preserves existing scheduled puzzles and creates only missing dates', async () => {
    const repository = new InMemoryDailyPuzzleRepository();
    const candidates = buildCandidates();
    repository.seed(scheduleDailyPuzzle(createDraftFromCandidates(START_DATE, candidates), {
      actorId: 'editor-2',
      occurredAt: OCCURRED_AT,
    }));

    const horizon = await createDailyEditorialHorizonService(repository).ensureHorizon(createInput(candidates));

    expect(horizon[0]?.status).toBe('scheduled');
    expect(horizon[0]?.revision).toBe(1);
    expect(repository.createCount).toBe(6);
  });

  it('reserves players from fixed later puzzles while filling earlier gaps', async () => {
    const repository = new InMemoryDailyPuzzleRepository();
    const candidates = buildCandidates();
    const laterDate = '2026-08-02';
    const later = scheduleDailyPuzzle(createDraftFromCandidates(laterDate, candidates), {
      actorId: 'editor-2',
      occurredAt: OCCURRED_AT,
    });
    repository.seed(later);

    const horizon = await createDailyEditorialHorizonService(repository).ensureHorizon({
      ...createInput(candidates),
      days: 2,
    });
    const earlierIds = new Set(horizon[0]!.selections.map(slot => slot.player?.canonicalPlayerId));
    const laterIds = new Set(later.selections.map(selection => selection.canonicalPlayerId));

    expect([...earlierIds].some(id => id !== undefined && laterIds.has(id))).toBe(false);
    expect(horizon[1]?.validation.valid).toBe(true);
  });

  it('does not regenerate records and returns dates in horizon order', async () => {
    const repository = new InMemoryDailyPuzzleRepository(true);
    const service = createDailyEditorialHorizonService(repository);
    await service.ensureHorizon(createInput());
    const createCount = repository.createCount;

    const horizon = await service.getHorizon({
      startDate: START_DATE,
      candidates: buildCandidates(),
    });

    expect(horizon.map(puzzle => puzzle.puzzleDate)).toEqual([
      '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04',
      '2026-08-05', '2026-08-06', '2026-08-07',
    ]);
    expect(repository.createCount).toBe(createCount);
  });

  it('surfaces unresolved canonical IDs without inventing review data', async () => {
    const repository = new InMemoryDailyPuzzleRepository();
    const candidates = buildCandidates();
    const draft = createDraftFromCandidates(START_DATE, candidates);
    repository.seed({
      ...draft,
      selections: draft.selections.map(selection => selection.slot === 1
        ? { ...selection, canonicalPlayerId: 'missing-player' }
        : selection),
    });

    const [puzzle] = await createDailyEditorialHorizonService(repository).getHorizon({
      startDate: START_DATE,
      days: 1,
      candidates,
    });

    expect(puzzle?.selections[0]?.player).toBeNull();
    expect(puzzle?.validation.slots[0]?.warnings).toEqual([
      'missing-recognizability-rank',
      'missing-reveal-data',
    ]);
  });

  it('rejects invalid horizon dates and lengths', async () => {
    const service = createDailyEditorialHorizonService(new InMemoryDailyPuzzleRepository());
    await expect(service.ensureHorizon({ ...createInput(), startDate: '2026-02-30' })).rejects.toThrow('Invalid Daily editorial horizon date');
    await expect(service.ensureHorizon({ ...createInput(), days: 0 })).rejects.toThrow('positive integer');
  });
});

function createDraftFromCandidates(
  puzzleDate: string,
  candidates: readonly DailyLineupCandidate[],
): DailyPuzzleEditorialRecord {
  const ranks = [1, 2, 251, 252, 1001, 1002, 2501, 2502, 2503];
  return createDailyPuzzleDraft({
    id: `daily-${puzzleDate}-v1`,
    puzzleDate,
    puzzleNumber: getDailyPuzzleNumber(puzzleDate),
    selections: ranks.map((rank, index) => ({
      slot: index + 1,
      canonicalPlayerId: candidates.find(candidate => candidate.recognizabilityRank === rank)!.canonicalPlayerId,
      source: 'generated',
    })),
    actorId: 'editor-1',
    occurredAt: OCCURRED_AT,
  });
}

class InMemoryDailyPuzzleRepository implements DailyPuzzleRepository {
  private readonly byDate = new Map<string, DailyPuzzleEditorialRecord>();
  createCount = 0;

  constructor(private readonly reverseRangeResults = false) {}

  get records(): readonly DailyPuzzleEditorialRecord[] {
    return [...this.byDate.values()];
  }

  seed(record: DailyPuzzleEditorialRecord): void {
    this.byDate.set(record.puzzleDate, record);
  }

  async getByDate(puzzleDate: string): Promise<DailyPuzzleEditorialRecord | null> {
    return this.byDate.get(puzzleDate) ?? null;
  }

  async listByDateRange(startDate: string, endDate: string): Promise<readonly DailyPuzzleEditorialRecord[]> {
    const records = [...this.byDate.values()]
      .filter(record => record.puzzleDate >= startDate && record.puzzleDate <= endDate)
      .sort((left, right) => left.puzzleDate.localeCompare(right.puzzleDate));
    return this.reverseRangeResults ? records.reverse() : records;
  }

  async save(record: DailyPuzzleEditorialRecord, options: DailyPuzzleRepositorySaveOptions): Promise<DailyPuzzleEditorialRecord> {
    const current = this.byDate.get(record.puzzleDate);
    if ((current?.revision ?? null) !== options.expectedRevision) throw new Error('revision conflict');
    if (current === undefined) this.createCount += 1;
    this.byDate.set(record.puzzleDate, record);
    return record;
  }
}
