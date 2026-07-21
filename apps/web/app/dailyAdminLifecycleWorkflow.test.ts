import {
  createDailyPuzzleDraft,
  getDailyPuzzleNumber,
  type DailyLineupCandidate,
  type DailyPuzzleEditorialRecord,
  type DailyPuzzleRepository,
  type DailyPuzzleRepositorySaveOptions,
} from '@initial-baseball/daily';
import type { Player } from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isDailyAdminLifecycleAction } from './dailyAdminLifecycleActions';
import {
  createDailyAdminWorkflow,
  type DailyAdminWorkflowDependencies,
} from './dailyAdminWorkflow';

const PUZZLE_DATE = '2026-07-22';
const CREATED_AT = '2026-07-21T12:00:00.000Z';
const RANKS = [1, 2, 251, 252, 1001, 1002, 2501, 2502, 2503] as const;

function buildCandidates(): DailyLineupCandidate[] {
  return RANKS.map((rank, index) => {
    const canonicalPlayerId = `player-${rank}`;
    return {
      canonicalPlayerId,
      player: buildPlayer(canonicalPlayerId, index),
      recognizabilityRank: rank,
      revealReady: true,
    };
  });
}

function buildPlayer(id: string, index: number): Player {
  return {
    id,
    fullName: `Player ${index + 1}`,
    displayName: `Player ${index + 1}`,
    primaryRole: 'hitter',
    primaryPosition: 'CF',
    mainDecade: '2000s',
    firstYear: 2000,
    lastYear: 2010,
    yearsPlayedDisplay: '2000–2010',
    primaryTeam: 'NYM',
    teamsDisplay: 'NYM',
    statsLine: 'HR 100 / RBI 400 / BA .280 / OBP .350 / SB 20',
    careerStats: null,
    dailyEligibilityTier: 'core',
    dailyEligible: true,
    aliases: [],
  };
}

function buildDraft(candidates: readonly DailyLineupCandidate[]): DailyPuzzleEditorialRecord {
  return createDailyPuzzleDraft({
    id: `daily-${PUZZLE_DATE}-v1`,
    puzzleDate: PUZZLE_DATE,
    puzzleNumber: getDailyPuzzleNumber(PUZZLE_DATE),
    selections: candidates.map((candidate, index) => ({
      slot: index + 1,
      canonicalPlayerId: candidate.canonicalPlayerId,
      source: 'generated' as const,
    })),
    actorId: 'generator',
    occurredAt: CREATED_AT,
  });
}

function dependencies(candidates: readonly DailyLineupCandidate[]): DailyAdminWorkflowDependencies {
  return {
    candidates,
    reviewedDataVersion: 'reviewed-test-v1',
    selectProductionLineup: () => [],
    getCurrentDailyDate: () => '2026-07-21',
    loadReveal: () => {
      throw new Error('Reveal loading is not used by lifecycle tests.');
    },
  };
}

describe('Daily admin lifecycle workflow', () => {
  it('recognizes only the explicit supported lifecycle actions', () => {
    expect(isDailyAdminLifecycleAction('schedule')).toBe(true);
    expect(isDailyAdminLifecycleAction('publish')).toBe(true);
    expect(isDailyAdminLifecycleAction('archive')).toBe(true);
    expect(isDailyAdminLifecycleAction('correct')).toBe(false);
    expect(isDailyAdminLifecycleAction('auto-publish')).toBe(false);
  });

  it('applies schedule, publish, and archive through the portable service with optimistic revisions', async () => {
    const candidates = buildCandidates();
    const repository = new InMemoryRepository();
    repository.seed(buildDraft(candidates));
    const workflow = createDailyAdminWorkflow(repository, dependencies(candidates));

    const scheduled = await workflow.transitionLifecycle({
      puzzleDate: PUZZLE_DATE,
      action: 'schedule',
      actorId: 'editor',
      occurredAt: '2026-07-21T13:00:00.000Z',
    });
    expect(scheduled.status).toBe('scheduled');
    expect(scheduled.revision).toBe(1);
    expect(scheduled.validation.valid).toBe(true);
    expect((await repository.getByDate(PUZZLE_DATE))?.scheduledBy).toBe('editor');

    const published = await workflow.transitionLifecycle({
      puzzleDate: PUZZLE_DATE,
      action: 'publish',
      actorId: 'editor',
      occurredAt: '2026-07-21T14:00:00.000Z',
    });
    expect(published.status).toBe('published');
    expect(published.revision).toBe(2);
    expect((await repository.getByDate(PUZZLE_DATE))?.publishedAt).toBe('2026-07-21T14:00:00.000Z');

    const archived = await workflow.transitionLifecycle({
      puzzleDate: PUZZLE_DATE,
      action: 'archive',
      actorId: 'editor',
      occurredAt: '2026-07-21T15:00:00.000Z',
    });
    expect(archived.status).toBe('archived');
    expect(archived.revision).toBe(3);
    expect((await repository.getByDate(PUZZLE_DATE))?.archivedBy).toBe('editor');
    expect(repository.expectedRevisions).toEqual([0, 1, 2]);
  });

  it('leaves transition order authoritative in the portable lifecycle service', async () => {
    const candidates = buildCandidates();
    const repository = new InMemoryRepository();
    repository.seed(buildDraft(candidates));
    const workflow = createDailyAdminWorkflow(repository, dependencies(candidates));

    await expect(workflow.transitionLifecycle({
      puzzleDate: PUZZLE_DATE,
      action: 'publish',
      actorId: 'editor',
      occurredAt: '2026-07-21T14:00:00.000Z',
    })).rejects.toThrow('Only scheduled Daily puzzles may be published');

    expect((await repository.getByDate(PUZZLE_DATE))?.status).toBe('draft');
    expect(repository.expectedRevisions).toEqual([]);
  });
});

class InMemoryRepository implements DailyPuzzleRepository {
  private readonly byDate = new Map<string, DailyPuzzleEditorialRecord>();
  readonly expectedRevisions: number[] = [];

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
    if (options.expectedRevision !== null) this.expectedRevisions.push(options.expectedRevision);
    this.byDate.set(record.puzzleDate, record);
    return record;
  }
}
