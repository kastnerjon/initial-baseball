import { describe, expect, it, vi } from 'vitest';
import {
  createDailyPuzzleDraft, getDailyPuzzleNumber,
  type ArchiveBetaDailyClueFrozenIssuedPuzzle,
  type DailyPuzzleEditorialRecord,
} from '@initial-baseball/daily';
vi.mock('server-only', () => ({}));
import { runArchiveBetaRollover, type ArchiveBetaRolloverDependencies } from './serverArchiveBetaRollover';
import { ArchiveBetaActivationError } from './serverArchiveBetaDailyVerification';

function setup(dates = ['2026-10-04', '2026-10-05', '2026-10-06']) {
  const records = new Map<string, DailyPuzzleEditorialRecord>(dates.map(date => [date, {
    ...createDailyPuzzleDraft({ id: date, puzzleDate: date, puzzleNumber: getDailyPuzzleNumber(date),
      selections: Array.from({ length: 9 }, (_, i) => ({ slot: i + 1, canonicalPlayerId: `player-${i}`, source: 'manual' as const })),
      actorId: 'editor', occurredAt: '2026-10-03T10:00:00Z' }),
    status: 'scheduled', revision: 10,
  }]));
  const issued = new Map<string, ArchiveBetaDailyClueFrozenIssuedPuzzle>();
  const repository = {
    getByDate: vi.fn(async (date: string) => records.get(date) ?? null),
    listByDateRange: vi.fn(async () => [...records.values()]),
    save: vi.fn(async (record: DailyPuzzleEditorialRecord, options: { expectedRevision: number | null }) => {
      expect(records.get(record.puzzleDate)?.revision).toBe(options.expectedRevision);
      records.set(record.puzzleDate, record);
      return record;
    }),
  };
  const issueAndVerify: ArchiveBetaRolloverDependencies['issueAndVerify'] = vi.fn(async (identity, issuedAt) => {
    expect(records.get(identity.puzzleDate)?.status).toBe('published');
    issued.set(identity.puzzleDate, { identity, puzzleId: `archive-beta-v1-daily-${identity.dailyNumber}`, issuedAt } as ArchiveBetaDailyClueFrozenIssuedPuzzle);
    return { status: 'created' as const, puzzleDate: identity.puzzleDate, dailyNumber: identity.dailyNumber, issuedAt };
  });
  const reader = { getByDate: vi.fn(async ({ puzzleDate }: { puzzleDate: string }) => issued.get(puzzleDate) ?? null), getByNumber: vi.fn(async () => null) };
  return { records, issued, repository, reader, issueAndVerify, dependencies: { repository, reader, issueAndVerify } };
}

describe('automatic completed-day archive rollover', () => {
  it('does no storage work before the beta epoch or before its first day ends', async () => {
    for (const instant of ['2026-10-03T10:00:00Z', '2026-10-04T10:00:00Z']) {
      expect(await runArchiveBetaRollover(new Date(instant))).toMatchObject({ created: 0, preserved: 0, failures: [] });
    }
  });
  it('recovers every missed date, locks exact source first, leaves it published, and retains original content on retry', async () => {
    const s = setup();
    const originalSelections = s.records.get('2026-10-06')!.selections;
    const now = new Date('2026-10-07T07:00:00Z');
    expect(await runArchiveBetaRollover(now, s.dependencies)).toMatchObject({ created: 3, failures: [], preserved: 0 });
    const frozen = [...s.issued.values()];
    const published = [...s.records.values()];
    expect(published.every(record => record.status === 'published' && record.revision === 11)).toBe(true);
    expect(s.records.get('2026-10-06')!.selections).toEqual(originalSelections);
    expect(await runArchiveBetaRollover(new Date('2026-10-07T08:00:00Z'), s.dependencies)).toMatchObject({ created: 0, preserved: 3, failures: [] });
    expect([...s.issued.values()]).toEqual(frozen);
    expect([...s.records.values()]).toEqual(published);
    expect(s.issueAndVerify).toHaveBeenCalledTimes(3);
    expect(s.repository.save).toHaveBeenCalledTimes(3);
  });
  it.each([
    ['2026-10-05T06:59:59Z', 0], ['2026-10-05T07:00:00Z', 1],
    ['2026-11-02T07:59:59Z', 28], ['2026-11-02T08:00:00Z', 29],
  ])('uses the Pacific completed-date boundary at %s', async (instant, expected) => {
    const s = setup();
    // Count reads to establish the date set independently of source availability.
    await runArchiveBetaRollover(new Date(instant), s.dependencies);
    expect(s.reader.getByDate).toHaveBeenCalledTimes(expected);
  });
  it('never issues or publishes today or future dates even if the provider returns them', async () => {
    const s = setup(['2026-10-04', '2026-10-05', '2026-10-06']);
    expect(await runArchiveBetaRollover(new Date('2026-10-05T08:00:00Z'), s.dependencies)).toMatchObject({ created: 1 });
    expect(s.repository.save).toHaveBeenCalledTimes(1);
    expect(s.records.get('2026-10-05')!.status).toBe('scheduled');
    expect(s.records.get('2026-10-06')!.status).toBe('scheduled');
  });
  it('keeps a committed publication retryable after issuance failure and does not block other days', async () => {
    const s = setup();
    vi.mocked(s.issueAndVerify).mockRejectedValueOnce(new Error('private provider/answer payload'));
    const first = await runArchiveBetaRollover(new Date('2026-10-07T07:00:00Z'), s.dependencies);
    expect(first).toMatchObject({ created: 2, failures: [{ puzzleDate: '2026-10-04', kind: 'unavailable' }] });
    const originalPublication = s.records.get('2026-10-04');
    expect(await runArchiveBetaRollover(new Date('2026-10-07T08:00:00Z'), s.dependencies)).toMatchObject({ created: 1, preserved: 2, failures: [] });
    expect(s.records.get('2026-10-04')).toEqual(originalPublication);
    expect(s.repository.save).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(first)).not.toContain('private');
  });
  it('preserves an already-issued copy without current player/clue rematerialization', async () => {
    const s = setup();
    const identity = { seriesVersion: 'archive-beta-v1' as const, puzzleDate: '2026-10-04', dailyNumber: 1 };
    const copy = { identity, puzzleId: 'archive-beta-v1-daily-1', issuedAt: '2026-10-05T01:39:24.760Z', clueSnapshot: { immutable: true } } as unknown as ArchiveBetaDailyClueFrozenIssuedPuzzle;
    s.issued.set(identity.puzzleDate, copy);
    await runArchiveBetaRollover(new Date('2026-10-05T08:00:00Z'), s.dependencies);
    expect(s.issueAndVerify).not.toHaveBeenCalled();
    expect(s.repository.save).not.toHaveBeenCalled();
    expect(s.issued.get(identity.puzzleDate)).toBe(copy);
  });
  it('does not invent missing or draft historical lineups', async () => {
    const s = setup(['2026-10-04']);
    s.records.set('2026-10-04', { ...s.records.get('2026-10-04')!, status: 'draft' });
    expect(await runArchiveBetaRollover(new Date('2026-10-06T08:00:00Z'), s.dependencies)).toMatchObject({
      created: 0, failures: [
        { puzzleDate: '2026-10-04', kind: 'missing-source' },
        { puzzleDate: '2026-10-05', kind: 'missing-source' },
      ],
    });
    expect(s.issueAndVerify).not.toHaveBeenCalled();
    expect(s.repository.save).not.toHaveBeenCalled();
  });
  it('does not issue after optimistic publication conflict and sanitizes immutable conflicts separately', async () => {
    const s = setup();
    s.repository.save.mockRejectedValueOnce(new Error('revision changed'));
    vi.mocked(s.issueAndVerify).mockRejectedValueOnce(new ArchiveBetaActivationError('immutable-conflict'));
    const result = await runArchiveBetaRollover(new Date('2026-10-07T08:00:00Z'), s.dependencies);
    expect(result).toMatchObject({ created: 1, failures: [
      { puzzleDate: '2026-10-04', kind: 'unavailable' },
      { puzzleDate: '2026-10-05', kind: 'immutable-conflict' },
    ] });
    expect(s.issueAndVerify).toHaveBeenCalledTimes(2);
  });
  it('bounds issuance work and resumes remaining dates on the next invocation', async () => {
    const dates = Array.from({ length: 32 }, (_, i) => new Date(Date.UTC(2026, 9, 4 + i)).toISOString().slice(0, 10));
    const s = setup(dates);
    const now = new Date('2026-11-05T08:00:00Z');
    expect(await runArchiveBetaRollover(now, s.dependencies)).toMatchObject({ created: 30, remaining: 2, failures: [] });
    expect(await runArchiveBetaRollover(now, s.dependencies)).toMatchObject({ created: 2, preserved: 30, remaining: 0, failures: [] });
    expect(s.repository.save).toHaveBeenCalledTimes(32);
  });
  it('fails closed on a provider row with the wrong numbered identity', async () => {
    const s = setup();
    s.issued.set('2026-10-04', { identity: { dailyNumber: 2 }, puzzleId: 'archive-beta-v1-daily-2' } as ArchiveBetaDailyClueFrozenIssuedPuzzle);
    expect(await runArchiveBetaRollover(new Date('2026-10-05T08:00:00Z'), s.dependencies)).toMatchObject({
      created: 0, failures: [{ puzzleDate: '2026-10-04', kind: 'unavailable' }],
    });
    expect(s.repository.save).not.toHaveBeenCalled();
    expect(s.issueAndVerify).not.toHaveBeenCalled();
  });
});
