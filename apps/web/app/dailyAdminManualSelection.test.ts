import type { Player } from '@initial-baseball/shared';
import {
  createDailyPuzzleDraft,
  type DailyLineupCandidate,
  type DailyPuzzleEditorialRecord,
  type DailyPuzzleRepository,
  type DailyPuzzleRepositorySaveOptions,
} from '@initial-baseball/daily';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createDailyAdminWorkflow } from './dailyAdminWorkflow';

const CURRENT_DATE = '2026-09-17';
const PUZZLE_DATE = '2026-09-20';
const OCCURRED_AT = '2026-09-17T17:00:00.000Z';

describe('Daily admin manual candidate policy', () => {
  it('allows a reveal-ready manual candidate outside the automatic Daily pool', async () => {
    const candidates = buildCandidates();
    const editorialOnly = candidates[4]!;
    const repository = new InMemoryRepository();
    repository.seed(createDailyPuzzleDraft({
      id: `daily-${PUZZLE_DATE}-v1`,
      puzzleDate: PUZZLE_DATE,
      puzzleNumber: 147,
      selections: candidates.map((candidate, index) => ({
        slot: index + 1,
        canonicalPlayerId: candidate.canonicalPlayerId,
        source: 'generated' as const,
      })),
      actorId: 'seed-editor',
      occurredAt: OCCURRED_AT,
    }));

    const workflow = createDailyAdminWorkflow(repository, {
      candidates,
      reviewedDataVersion: 'test-v1',
      selectProductionLineup: () => [],
      getCurrentDailyDate: () => CURRENT_DATE,
      loadReveal: () => {
        throw new Error('Reveal loading is not needed for lineup replacement.');
      },
    });

    const puzzle = await workflow.replaceLineup({
      puzzleDate: PUZZLE_DATE,
      canonicalPlayerIds: candidates.map(candidate => candidate.canonicalPlayerId),
      actorId: 'chatops:assistant',
      occurredAt: OCCURRED_AT,
    });

    expect(puzzle.selections[4]?.player?.canonicalPlayerId).toBe(editorialOnly.canonicalPlayerId);
    expect(puzzle.selections[4]?.source).toBe('manual');
    expect(puzzle.validation.slots[4]?.warnings).toContain('outside-automatic-daily-pool');
    expect((await repository.getByDate(PUZZLE_DATE))?.selections[4]?.canonicalPlayerId)
      .toBe(editorialOnly.canonicalPlayerId);
  });
});

function buildCandidates(): DailyLineupCandidate[] {
  return Array.from({ length: 9 }, (_, index) => ({
    canonicalPlayerId: `canonical:${index + 1}`,
    player: buildPlayer(index + 1),
    recognizabilityRank: index === 4 ? null : index + 1,
    revealReady: true,
  }));
}

function buildPlayer(index: number): Player {
  return {
    id: `legacy:${index}`,
    fullName: `Player ${index}`,
    displayName: `Player ${index}`,
    primaryRole: 'hitter',
    primaryPosition: '1B',
    mainDecade: '2000s',
    firstYear: 2000,
    lastYear: 2010,
    yearsPlayedDisplay: '2000–2010',
    primaryTeam: 'NYY',
    teamsDisplay: 'NYY',
    statsLine: 'HR 100 / RBI 500 / BA .280 / OBP .350 / SB 20',
    careerStats: null,
    dailyEligibilityTier: 'none',
    dailyEligible: false,
    aliases: [],
  };
}

class InMemoryRepository implements DailyPuzzleRepository {
  private readonly records = new Map<string, DailyPuzzleEditorialRecord>();

  seed(record: DailyPuzzleEditorialRecord): void {
    this.records.set(record.puzzleDate, record);
  }

  async getByDate(puzzleDate: string): Promise<DailyPuzzleEditorialRecord | null> {
    return this.records.get(puzzleDate) ?? null;
  }

  async listByDateRange(startDate: string, endDate: string): Promise<readonly DailyPuzzleEditorialRecord[]> {
    return [...this.records.values()]
      .filter(record => record.puzzleDate >= startDate && record.puzzleDate <= endDate)
      .sort((left, right) => left.puzzleDate.localeCompare(right.puzzleDate));
  }

  async save(
    record: DailyPuzzleEditorialRecord,
    options: DailyPuzzleRepositorySaveOptions,
  ): Promise<DailyPuzzleEditorialRecord> {
    const current = this.records.get(record.puzzleDate);
    if ((current?.revision ?? null) !== options.expectedRevision) {
      throw new Error('revision conflict');
    }
    this.records.set(record.puzzleDate, record);
    return record;
  }
}
