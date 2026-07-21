import type { CanonicalPlayerReveal } from '@initial-baseball/baseball-data/runtime';
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
import {
  createDailyAdminWorkflow,
  type DailyAdminWorkflowDependencies,
} from './dailyAdminWorkflow';

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
    return buildCandidate(canonicalPlayerId, recognizabilityRank);
  });
}

function buildCandidate(
  canonicalPlayerId: string,
  recognizabilityRank: number,
  playerOverrides: Partial<Player> = {},
): DailyLineupCandidate {
  return {
    canonicalPlayerId,
    player: buildPlayer(canonicalPlayerId, playerOverrides),
    recognizabilityRank,
    revealReady: true,
  };
}

function buildPlayer(id: string, overrides: Partial<Player> = {}): Player {
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
    statsLine: 'HR 100 / RBI 400 / BA .280 / OBP .350 / SB 20',
    careerStats: null,
    dailyEligibilityTier: 'core',
    dailyEligible: true,
    aliases: [],
    ...overrides,
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
    loadReveal: canonicalPlayerId => buildReveal(canonicalPlayerId, candidates),
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

  it('searches aliases and preserves distinct same-name canonical players for editorial review', () => {
    const candidates = buildCandidates();
    candidates[0] = buildCandidate('ben-taylor-old', 1, {
      fullName: 'Benjamin Taylor',
      displayName: 'Ben Taylor',
      aliases: ['Buck Taylor'],
      firstYear: 1908,
      lastYear: 1929,
      yearsPlayedDisplay: '1908–1929',
      teamsDisplay: 'IND, BIR',
    });
    candidates[1] = buildCandidate('ben-taylor-new', 2, {
      displayName: 'Ben Taylor',
      aliases: ['Ben Eugene Taylor'],
      firstYear: 1920,
      lastYear: 1920,
      yearsPlayedDisplay: '1920',
      teamsDisplay: 'PHI',
    });
    const workflow = createDailyAdminWorkflow(new InMemoryRepository(), dependencies(candidates));

    expect(workflow.searchPlayers('Buck Taylor').map(result => result.canonicalPlayerId)).toEqual(['ben-taylor-old']);
    const sameName = workflow.searchPlayers('Ben Taylor');
    expect(sameName.map(result => result.canonicalPlayerId)).toEqual(['ben-taylor-new', 'ben-taylor-old']);
    expect(sameName.every(result => result.requiresYearDisambiguation)).toBe(true);
    expect(sameName.map(result => result.yearsPlayedDisplay)).toEqual(['1920', '1908–1929']);
  });

  it('previews the exact initials, ordered hints, and canonical reveal selected by the admin', () => {
    const candidates = buildCandidates();
    candidates[0] = buildCandidate('griffey', 1, {
      fullName: 'George Kenneth Griffey Jr.',
      displayName: 'Ken Griffey Jr.',
      aliases: ['Junior'],
      firstYear: 1989,
      lastYear: 2010,
      yearsPlayedDisplay: '1989–2010',
      teamsDisplay: 'SEA, CIN, CWS',
      statsLine: 'HR 630 / RBI 1836 / BA .284 / OBP .370 / SB 184',
    });
    const workflow = createDailyAdminWorkflow(new InMemoryRepository(), dependencies(candidates));

    const preview = workflow.previewPlayer('griffey');

    expect(preview?.initials).toBe('KGJ');
    expect(preview?.hints.map(hint => [hint.hintType, hint.hintValue])).toEqual([
      ['main_decade', '2000s'],
      ['teams', 'SEA, CIN, CWS'],
      ['position', 'CF'],
      ['stats', 'HR 630 / RBI 1836 / BA .284 / OBP .370 / SB 184'],
    ]);
    expect(preview?.reveal.playerId).toBe('griffey');
    expect(preview?.reveal.career.firstSeason).toBe(1989);
  });

  it('replaces a future slot through the portable service and returns rerun validation', async () => {
    const repository = new InMemoryRepository();
    const candidates = buildCandidates();
    const replacement = candidates.find(candidate => candidate.recognizabilityRank === 253)!;
    const prior = buildDraft('2026-07-21', candidates);
    repository.seed({
      ...prior,
      selections: prior.selections.map(selection => selection.slot === 1
        ? { ...selection, canonicalPlayerId: replacement.canonicalPlayerId }
        : selection),
    });
    repository.seed(buildDraft('2026-07-22', candidates));

    const puzzle = await createDailyAdminWorkflow(repository, dependencies(candidates)).replaceSelection({
      puzzleDate: '2026-07-22',
      slot: 1,
      canonicalPlayerId: replacement.canonicalPlayerId,
      actorId: 'daily-editor',
      occurredAt: '2026-07-21T19:00:00.000Z',
    });

    expect(puzzle.revision).toBe(1);
    expect(puzzle.selections[0]?.source).toBe('manual');
    expect(puzzle.validation.slots[0]?.warnings).toEqual([
      'outside-recognizability-band',
      'recently-used',
    ]);
    expect((await repository.getByDate('2026-07-22'))?.updatedBy).toBe('daily-editor');
  });

  it('rejects non-future dates and canonical IDs outside the reviewed candidate universe', async () => {
    const repository = new InMemoryRepository();
    const candidates = buildCandidates();
    repository.seed(buildDraft('2026-07-21', candidates));
    repository.seed(buildDraft('2026-07-22', candidates));
    const workflow = createDailyAdminWorkflow(repository, dependencies(candidates));

    await expect(workflow.replaceSelection({
      puzzleDate: '2026-07-21',
      slot: 1,
      canonicalPlayerId: candidates[1]!.canonicalPlayerId,
      actorId: 'daily-editor',
      occurredAt: OCCURRED_AT,
    })).rejects.toMatchObject({ kind: 'not-future-puzzle' });

    await expect(workflow.replaceSelection({
      puzzleDate: '2026-07-22',
      slot: 1,
      canonicalPlayerId: 'unknown-canonical-player',
      actorId: 'daily-editor',
      occurredAt: OCCURRED_AT,
    })).rejects.toMatchObject({ kind: 'unknown-player' });
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
  const selections = ranks.map((rank, index) => ({
    slot: index + 1,
    canonicalPlayerId: candidates.find(candidate => candidate.recognizabilityRank === rank)?.canonicalPlayerId
      ?? candidates[index]!.canonicalPlayerId,
    source: 'generated' as const,
  }));
  return createDailyPuzzleDraft({
    id: `daily-${puzzleDate}-v1`,
    puzzleDate,
    puzzleNumber: getDailyPuzzleNumber(puzzleDate),
    selections,
    actorId: 'seed-editor',
    occurredAt: OCCURRED_AT,
  });
}

function buildReveal(
  canonicalPlayerId: string,
  candidates: readonly DailyLineupCandidate[],
): CanonicalPlayerReveal {
  const candidate = candidates.find(item => item.canonicalPlayerId === canonicalPlayerId);
  const player = candidate?.player ?? buildPlayer(canonicalPlayerId);
  return {
    schemaVersion: 1,
    playerId: canonicalPlayerId,
    lahmanPlayerId: `lahman-${canonicalPlayerId}`,
    displayName: player.displayName,
    playerType: player.primaryRole === 'two_way' ? 'two-way' : player.primaryRole,
    career: {
      firstSeason: player.firstYear ?? 2000,
      lastSeason: player.lastYear ?? 2000,
      seasonCount: 1,
      teamIds: ['NYN'],
      teamIdentities: [{ sourceTeamId: 'NYN', abbreviation: player.teamsDisplay || 'NYM', displayName: 'New York Mets' }],
      primaryPosition: player.primaryPosition,
      batting: {
        atBats: 100,
        runs: 20,
        hits: 28,
        doubles: 5,
        triples: 1,
        homeRuns: 10,
        runsBattedIn: 40,
        stolenBases: 2,
        walks: 10,
        battingAverage: 0.28,
        sluggingPercentage: 0.5,
      },
      pitching: null,
      advanced: {
        onBasePercentage: 0.35,
        sluggingPercentage: 0.5,
        ops: 0.85,
        war: null,
        opsPlus: null,
        eraPlus: null,
        fip: null,
      },
      achievements: null,
    },
    seasons: [],
    provenance: {
      canonicalUniversePresent: true,
      careerEnrichmentPresent: true,
      seasonCardCount: 0,
      legalNameExcludedFromDisplayPayload: true,
    },
  };
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
