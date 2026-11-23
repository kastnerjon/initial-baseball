import type { Player } from '@initial-baseball/shared';
import {
  archiveDailyPuzzle,
  createDailyPuzzleDraft,
  publishDailyPuzzle,
  getDailyPuzzleNumber,
  scheduleDailyPuzzle,
  type DailyLineupCandidate,
  type DailyPuzzleEditorialRecord,
  type DailyPuzzleRepository,
} from '@initial-baseball/daily';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  createDailyAdminWorkflow,
  type DailyAdminWorkflowDependencies,
} from './dailyAdminWorkflow';

const OCCURRED_AT = '2026-11-22T12:00:00.000Z';

function candidates(): DailyLineupCandidate[] {
  return Array.from({ length: 18 }, (_, index) => {
    const id = `player-${index + 1}`;
    const player: Player = {
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
      statsLine: 'HR 100 / RBI 400 / BA .280 / OBP .350 / SB 20',
      careerStats: null,
      dailyEligibilityTier: 'core',
      dailyEligible: true,
      aliases: [],
    };
    return { canonicalPlayerId: id, player, recognizabilityRank: index + 1, revealReady: true };
  });
}

function draft(date: string, pool: readonly DailyLineupCandidate[]): DailyPuzzleEditorialRecord {
  return createDailyPuzzleDraft({
    id: `daily-${date}-v1`,
    puzzleDate: date,
    puzzleNumber: getDailyPuzzleNumber(date),
    selections: pool.slice(0, 9).map((player, index) => ({
      slot: index + 1,
      canonicalPlayerId: player.canonicalPlayerId,
      source: 'generated' as const,
    })),
    actorId: 'seed-editor',
    occurredAt: OCCURRED_AT,
  });
}

function setup(today: string) {
  const pool = candidates();
  const rows = new Map<string, DailyPuzzleEditorialRecord>();
  const repository: DailyPuzzleRepository = {
    getByDate: async date => rows.get(date) ?? null,
    listByDateRange: async (start, end) => [...rows.values()]
      .filter(record => record.puzzleDate >= start && record.puzzleDate <= end),
    save: async () => { throw new Error('Read-only history must not write.'); },
  };
  const dependencies: DailyAdminWorkflowDependencies = {
    candidates: pool,
    reviewedDataVersion: 'history-test-v1',
    getCurrentDailyDate: () => today,
    selectProductionLineup: date => pool.slice(9, 18).map(candidate => ({
      canonicalPlayerId: `${candidate.canonicalPlayerId}-${date}`,
      player: candidate.player,
    })),
    loadReveal: () => { throw new Error('Not needed for history.'); },
  };
  return {
    pool,
    rows,
    workflow: createDailyAdminWorkflow(repository, dependencies),
  };
}

describe('Authenticated primary Daily history read model', () => {
  it('shows the live editorial lineup, then fallback for draft-only and absent dates without writes', async () => {
    const { pool, rows, workflow } = setup('2026-11-23');
    rows.set('2026-11-23', scheduleDailyPuzzle(draft('2026-11-23', pool), {
      actorId: 'daily-editor', occurredAt: OCCURRED_AT,
    }));
    rows.set('2026-11-22', draft('2026-11-22', pool));

    const history = await workflow.getHistory('2026-11-23', 3);
    expect(history.map(day => day.puzzleDate)).toEqual(['2026-11-23', '2026-11-22', '2026-11-21']);
    expect(history[0]?.status).toBe('scheduled');
    expect(history[0]?.players.map(p => p.displayName)).toEqual(pool.slice(0, 9).map(p => p.player.displayName));
    expect(history[1]?.status).toBe('fallback');
    expect(history[1]?.players[0]?.displayName).toBe(pool[9]?.player.displayName);
    expect(history[2]?.status).toBe('fallback');
    expect(rows.size).toBe(2);
  });

  it('preserves archived editorial selections as immutable historical facts', async () => {
    const { pool, rows, workflow } = setup('2026-11-23');
    const scheduled = scheduleDailyPuzzle(draft('2026-11-22', pool), {
      actorId: 'daily-editor', occurredAt: '2026-11-21T12:00:00.000Z',
    });
    const published = publishDailyPuzzle(scheduled, {
      actorId: 'daily-editor', occurredAt: '2026-11-22T12:00:00.000Z',
    });
    const archived = archiveDailyPuzzle(published, {
      actorId: 'daily-editor', occurredAt: '2026-11-23T12:00:00.000Z',
    });
    rows.set('2026-11-22', archived);

    const history = await workflow.getHistory('2026-11-22', 1);
    expect(history[0]?.status).toBe('archived');
    expect(history[0]?.players.map(p => p.displayName)).toEqual(pool.slice(0, 9).map(p => p.player.displayName));
    expect(history[0]?.players).toHaveLength(9);
    expect(rows.get('2026-11-22')).toBe(archived);
  });

  it('uses the public deterministic selection policy for dates before editorial launch', async () => {
    const { pool, rows, workflow } = setup('2026-07-21');
    rows.set('2026-07-21', scheduleDailyPuzzle(draft('2026-07-21', pool), {
      actorId: 'daily-editor', occurredAt: OCCURRED_AT,
    }));
    const history = await workflow.getHistory('2026-07-21', 1);
    expect(history[0]?.status).toBe('fallback');
    expect(history[0]?.players[0]?.displayName).toBe(pool[9]?.player.displayName);
  });

  it('rejects future dates, impossible dates and oversized pages; stops at the epoch', async () => {
    const { workflow } = setup('2026-07-21');
    await expect(workflow.getHistory('2026-07-22')).rejects.toThrow('outside the available Daily range');
    await expect(workflow.getHistory('2026-02-30')).rejects.toThrow('outside the available Daily range');
    await expect(workflow.getHistory('2026-07-21', 31)).rejects.toThrow('between 1 and 30 days');
    const first = await workflow.getHistory('2026-04-27', 30);
    expect(first).toHaveLength(1);
    expect(first[0]?.puzzleNumber).toBe(1);
  });
});
