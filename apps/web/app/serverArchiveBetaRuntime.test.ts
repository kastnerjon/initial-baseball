import { describe, expect, it, vi } from 'vitest';
import { createArchiveBetaDailyClueFrozenIssuedPuzzle, createPermanentDailyIssuedClueSnapshot, type ArchiveBetaDailyIssuedPuzzleReadService } from '@initial-baseball/daily';
import { CURRENT_DAILY_RULESET_VERSION, DEFAULT_DAILY_HINT_CONFIG, type Player, type DailyGameState } from '@initial-baseball/shared';
vi.mock('server-only', () => ({}));
const query = vi.hoisted(() => ({ select: vi.fn(), eq: vi.fn(), lte: vi.fn(), order: vi.fn(), limit: vi.fn() }));
const submission = vi.hoisted(() => vi.fn());
vi.mock('react', () => ({ useEffect: (effect: () => void) => effect(), useCallback: (callback: unknown) => callback }));
vi.mock('./dailyCompletedResultClient', () => ({ submitCompletedDailyResultIfNeeded: submission }));
vi.mock('./serverSupabaseClient', () => ({ createServerSupabaseClient: () => ({ from: () => query }) }));
import { createServerArchiveBetaRuntime, getAvailableArchiveBetaIdentity, listAvailableArchiveBetaPuzzles, selectDailyProgressionRuntime } from './serverArchiveBetaRuntime';
import { materializePermanentDailyIssuedPuzzle } from './permanentDailyPuzzleMaterialization';
import { createDailyProgressionTokenCodec } from './dailyProgressionToken';
import { DailyRuntimeRequestError } from './dailyRuntimeService';
import { useCompletedDailyResultSubmission } from './useCompletedDailyResultSubmission';

const date = '2026-10-04';
const now = () => new Date('2026-10-05T01:00:00Z');
const tokens = createDailyProgressionTokenCodec('archive-beta-runtime-test-secret-0123456789');
const ids = Array.from({ length: 9 }, (_, i) => `ibp_${i.toString(16).padStart(20, '0')}`);
const record = createArchiveBetaDailyClueFrozenIssuedPuzzle({
  identity: getAvailableArchiveBetaIdentity(1, now())!, canonicalPlayerIds: ids, issuedAt: '2026-10-04T08:00:00Z',
  clueSnapshot: createPermanentDailyIssuedClueSnapshot({
    hintLayout: DEFAULT_DAILY_HINT_CONFIG.map(({ slot, hintType, displayLabel }) => ({ slot, hintType, displayLabel })),
    pitches: ids.map((canonicalPlayerId, i) => ({ pitchNumber: i + 1, canonicalPlayerId, initials: 'ZZ',
      hintValues: [`FROZEN_DECADE_${i}`, `FROZEN_TEAMS_${i}`, `FROZEN_POSITION_${i}`, `FROZEN_STATS_${i}`] })),
  }),
});
function setup() {
  const reader: ArchiveBetaDailyIssuedPuzzleReadService = { getByDate: vi.fn(async () => record), getByNumber: vi.fn(async () => record) };
  const runtime = createServerArchiveBetaRuntime({ reader, now, progressionTokens: tokens,
    materialize: value => materializePermanentDailyIssuedPuzzle(value, id => player(id)), resolveLegacyPlayerId: id => id,
    getCanonicalReveal: playerId => ({ schemaVersion: 1, playerId, lahmanPlayerId: 'answer01', displayName: 'Hidden Answer', playerType: 'hitter',
      career: { firstSeason: 2000, lastSeason: 2010, seasonCount: 11, teamIds: ['NYY'], primaryPosition: 'CF', batting: null, pitching: null, advanced: null, achievements: {} },
      seasons: [], provenance: { canonicalUniversePresent: true, careerEnrichmentPresent: true, seasonCardCount: 0, legalNameExcludedFromDisplayPayload: true } }),
  });
  return { reader, runtime };
}
function player(id: string): Player {
  return { id, fullName: 'Hidden Answer', displayName: 'Hidden Answer', primaryRole: 'hitter', primaryPosition: 'CF', mainDecade: '2000s',
    firstYear: 2000, lastYear: 2010, yearsPlayedDisplay: '2000–2010', primaryTeam: 'NYY', teamsDisplay: 'NYY', statsLine: 'changed live stats',
    careerStats: null, dailyEligibilityTier: 'core', dailyEligible: true, aliases: [] };
}

describe('playable archive beta boundaries', () => {
  it('never retries or creates current-Daily completed results from archive gameplay', () => {
    submission.mockClear();
    for (const id of ['archive-beta-v1-daily-1', 'permanent-v1-daily-1']) {
      const state = { puzzle: { id }, rulesetVersion: CURRENT_DAILY_RULESET_VERSION, status: 'completed', completedAtBats: [] } as unknown as DailyGameState;
      useCompletedDailyResultSubmission(true, state).submitCreationIfEligible({ allowCreate: true });
    }
    expect(submission).not.toHaveBeenCalled();
    const current = { puzzle: { id: 'daily-current' }, rulesetVersion: CURRENT_DAILY_RULESET_VERSION, status: 'completed', completedAtBats: [] } as unknown as DailyGameState;
    useCompletedDailyResultSubmission(true, current).submitCreationIfEligible({ allowCreate: true });
    expect(submission).toHaveBeenCalledTimes(2);
  });
  it('serves frozen clues while withholding answers and future batter hint values', async () => {
    const { runtime } = setup();
    const bootstrap = await runtime.getBootstrap(date);
    const json = JSON.stringify(bootstrap);
    expect(bootstrap.rulesetVersion).toBe(CURRENT_DAILY_RULESET_VERSION);
    expect(bootstrap.puzzle.pitches).toHaveLength(9);
    expect(bootstrap.puzzle.pitches.every(pitch => pitch.initials === 'ZZ')).toBe(true);
    expect(json).toContain('FROZEN_DECADE_0');
    expect(json).not.toContain('FROZEN_DECADE_1');
    expect(json).not.toContain('Hidden Answer');
    for (const id of ids) expect(json).not.toContain(id);
    expect(json).not.toContain('changed live stats');
    const checkpoint = bootstrap.hintBundle.checkpoints[0]!;
    expect((await runtime.getHintBundle(checkpoint.progressionToken)).hintBundle.revealedCount).toBe(1);
  });
  it('plays all nine under current rules even after three outs, then rejects completed progression', async () => {
    const { runtime } = setup();
    let token = (await runtime.getBootstrap(date)).progressionToken;
    for (let i = 0; i < 9; i++) {
      const response = await runtime.resolveAtBat({ progressionToken: token, giveUp: true });
      token = response.progressionToken;
      expect(tokens.verify(token).completed).toBe(i === 8);
      expect(response.reveal).not.toBeNull();
      expect(response.hintBundle?.pitchNumber ?? null).toBe(i === 8 ? null : i + 2);
    }
    await expect(runtime.resolveAtBat({ progressionToken: token, giveUp: true })).rejects.toBeInstanceOf(DailyRuntimeRequestError);
  });
  it('rejects pre-epoch and future dates before reading and missing rows without regeneration', async () => {
    const { reader, runtime } = setup();
    for (const unavailable of ['2026-10-03', '2026-10-05']) await expect(runtime.getBootstrap(unavailable)).rejects.toBeInstanceOf(DailyRuntimeRequestError);
    expect(reader.getByDate).not.toHaveBeenCalled();
    vi.mocked(reader.getByDate).mockResolvedValue(null);
    await expect(runtime.getBootstrap(date)).rejects.toThrow('has not been issued');
    expect(getAvailableArchiveBetaIdentity(0, now())).toBeNull();
    expect(getAvailableArchiveBetaIdentity(2, now())).toBeNull();
  });
  it('sanitizes provider errors and enforces the signed exact puzzle identity', async () => {
    const { reader, runtime } = setup();
    const bootstrap = await runtime.getBootstrap(date);
    const wrong = tokens.sign({ ...tokens.verify(bootstrap.progressionToken), puzzleId: 'daily-current-same-date' });
    await expect(runtime.getHintBundle(wrong)).rejects.toBeInstanceOf(DailyRuntimeRequestError);
    vi.mocked(reader.getByDate).mockRejectedValue(new Error('secret answer provider payload'));
    await expect(runtime.getBootstrap(date)).rejects.toThrow(/^The archive is temporarily unavailable\.$/);
  });
  it('verifies signatures before series dispatch or creating an archive reader', async () => {
    const { runtime } = setup();
    const archive = vi.fn(() => runtime);
    const current = { ...runtime };
    const token = (await runtime.getBootstrap(date)).progressionToken;
    expect(selectDailyProgressionRuntime(token, tokens, current, archive)).toBe(runtime);
    archive.mockClear();
    expect(() => selectDailyProgressionRuntime(`${token}x`, tokens, current, archive)).toThrow('Invalid Daily progression token');
    expect(archive).not.toHaveBeenCalled();
    const currentToken = tokens.sign({ ...tokens.verify(token), puzzleId: 'daily-current-same-date' });
    expect(selectDailyProgressionRuntime(currentToken, tokens, current, archive)).toBe(current);
    expect(archive).not.toHaveBeenCalled();
  });
  it('catalog queries only bounded available beta metadata and fails closed on invalid identities', async () => {
    for (const method of [query.select, query.eq, query.lte, query.order]) method.mockReturnValue(query);
    query.limit.mockResolvedValue({ data: [{ daily_number: 1, puzzle_date: date, puzzle_id: record.puzzleId }], error: null });
    expect(await listAvailableArchiveBetaPuzzles(now())).toEqual([record.identity]);
    expect(query.select).toHaveBeenCalledWith('daily_number,puzzle_date,puzzle_id');
    expect(query.eq).toHaveBeenCalledWith('series_version', 'archive-beta-v1');
    expect(query.lte).toHaveBeenCalledWith('puzzle_date', date);
    expect(query.limit).toHaveBeenCalledWith(60);
    query.limit.mockResolvedValue({ data: [{ daily_number: 2, puzzle_date: '2026-10-05', puzzle_id: 'archive-beta-v1-daily-2' }], error: null });
    await expect(listAvailableArchiveBetaPuzzles(now())).rejects.toThrow(/^The archive list is temporarily unavailable\.$/);
  });
});
