import type { Player } from '@initial-baseball/shared';
import {
  createDailyPuzzleDraft,
  getDailyPuzzleNumber,
  type DailyLineupCandidate,
  type DailyPuzzleEditorialRecord,
  type DailyPuzzleRepository,
  type DailyPuzzleRepositorySaveOptions,
} from '@initial-baseball/daily';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isSameOriginDailyAdminMutation } from './dailyAdminRequestSecurity';
import { createDailyAdminWorkflow, type DailyAdminWorkflowDependencies } from './dailyAdminWorkflow';

const OCCURRED_AT = '2026-07-21T18:00:00.000Z';

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
    const recognizabilityRank = startRank + index;
    const canonicalPlayerId = `player-${recognizabilityRank}`;
    return {
      canonicalPlayerId,
      player: buildPlayer(canonicalPlayerId),
      recognizabilityRank,
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

function dependencies(candidates = buildCandidates()): DailyAdminWorkflowDependencies {
  return {
    candidates,
    reviewedDataVersion: 'reviewed-test-v1',
    getCurrentDailyDate: () => '2026-07-21',
    selectProductionLineup: date => candidates.slice(0, 9).map(candidate => ({
      canonicalPlayerId: `${candidate.canonicalPlayerId}-${date}`,
      player: candidate.player,
    })),
  };
}

describe('Daily admin workflow', () => {
  it('defaults the operational horizon to tomorrow in the Daily time zone', async () => {
    const repository = new InMemoryRepository();
    const candidates = buildCandidates();
    repository.seed(buildDraft('2026-07-22', candidates));

    const horizon = await createDailyAdminWorkflow(repository, dependencies(candidates)).getHorizon();

    expect(horizon.map(puzzle => puzzle.puzzleDate)).toEqual(['2026-07-22']);
  });

  it('creates seven authorized drafts and records adapter-supplied audit metadata', async () => {
    const repository = new InMemoryRepository();

    const horizon = await createDailyAdminWorkflow(repository, dependencies()).ensureHorizon({
      actorId: 'daily-editor',
      occurredAt: OCCURRED_AT,
    });

    expect(horizon).toHaveLength(7);
    expect(horizon.every(puzzle => puzzle.status === 'draft')).toBe(true);
    expect(repository.records).toHaveLength(7);
    expect(repository.records.every(record => (
      record.createdBy === 'daily-editor'
      && record.createdAt === OCCURRED_AT
    ))).toBe(true);
  });

  it('uses persisted editorial history instead of generated baseline history for the same date', async () => {
    const repository = new InMemoryRepository();
    const candidates = buildCandidates();
    const priorDate = '2026-07-21';
    const currentDate = '2026-07-22';
    repository.seed(buildDraft(priorDate, candidates));
    repository.seed(buildDraft(currentDate, candidates));
    const injected = dependencies(candidates);
    injected.selectProductionLineup = date => candidates.slice(9, 18).map(candidate => ({
      canonicalPlayerId: `${candidate.canonicalPlayerId}-${date}`,
      player: candidate.player,
    }));

    const [puzzle] = await createDailyAdminWorkflow(repository, injected).getHorizon(currentDate);

    expect(puzzle?.validation.slots[0]?.lastDailyUsage).toBe(priorDate);
    expect(puzzle?.validation.slots[0]?.warnings).toContain('recently-used');
  });
});

describe('Daily admin mutation boundary', () => {
  it('accepts same-origin browser submissions and non-browser requests without Origin', () => {
    expect(isSameOriginDailyAdminMutation(new Request('https://initial.example/admin/daily/generate', {
      method: 'POST',
      headers: { origin: 'https://initial.example' },
    }))).toBe(true);
    expect(isSameOriginDailyAdminMutation(new Request('https://initial.example/admin/daily/generate', {
      method: 'POST',
    }))).toBe(true);
  });

  it('rejects cross-origin browser submissions', () => {
    expect(isSameOriginDailyAdminMutation(new Request('https://initial.example/admin/daily/generate', {
      method: 'POST',
      headers: { origin: 'https://attacker.example' },
    }))).toBe(false);
  });
});

function buildDraft(
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
    actorId: 'seed-editor',
    occurredAt: OCCURRED_AT,
  });
}

class InMemoryRepository implements DailyPuzzleRepository {
  private readonly byDate = new Map<string, DailyPuzzleEditorialRecord>();

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
    return [...this.byDate.values()]
      .filter(record => record.puzzleDate >= startDate && record.puzzleDate <= endDate)
      .sort((left, right) => left.puzzleDate.localeCompare(right.puzzleDate));
  }

  async save(
    record: DailyPuzzleEditorialRecord,
    options: DailyPuzzleRepositorySaveOptions,
  ): Promise<DailyPuzzleEditorialRecord> {
    const current = this.byDate.get(record.puzzleDate);
    if ((current?.revision ?? null) !== options.expectedRevision) throw new Error('revision conflict');
    this.byDate.set(record.puzzleDate, record);
    return record;
  }
}
