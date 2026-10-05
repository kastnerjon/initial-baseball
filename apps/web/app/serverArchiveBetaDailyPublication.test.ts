import { describe, expect, it, vi } from 'vitest';
import { createDailyPuzzleDraft, getDailyPuzzleNumber, type DailyPuzzleEditorialRecord, type DailyPuzzleRepository } from '@initial-baseball/daily';
vi.mock('server-only', () => ({}));
import { ArchiveBetaActivationError } from './serverArchiveBetaDailyVerification';
import { transitionDailyLifecycleWithArchiveBeta } from './serverArchiveBetaDailyPublication';

const input = { puzzleDate: '2026-10-08', action: 'publish' as const, actorId: 'editor', occurredAt: '2026-10-05T01:00:00.000Z' };
function setup(status: 'draft' | 'scheduled' | 'published' = 'scheduled') {
  let record: DailyPuzzleEditorialRecord = { ...createDailyPuzzleDraft({ id: 'test', puzzleDate: input.puzzleDate, puzzleNumber: getDailyPuzzleNumber(input.puzzleDate),
    selections: Array.from({ length: 9 }, (_, index) => ({ slot: index + 1, canonicalPlayerId: `player-${index}`, source: 'generated' as const })),
    actorId: 'generator', occurredAt: input.occurredAt }), status, revision: 2 };
  const events: string[] = [];
  const repository: DailyPuzzleRepository = {
    getByDate: vi.fn(async () => record), listByDateRange: vi.fn(async () => [record]), save: vi.fn(async value => value),
  };
  const transition = vi.fn(async (value: Parameters<typeof transitionDailyLifecycleWithArchiveBeta>[1] = input) => {
    events.push(value.action);
    record = { ...record, status: value.action === 'archive' ? 'archived' : 'published', revision: record.revision + 1, publishedAt: input.occurredAt, publishedBy: input.actorId };
    return record;
  });
  const issueAndVerify = vi.fn(async () => {
    events.push('verify');
    expect(record.status).toBe('published');
    return { status: 'created' as const, puzzleDate: input.puzzleDate, dailyNumber: 5, issuedAt: input.occurredAt };
  });
  return { repository, transition, issueAndVerify, events, getRecord: () => record, dependencies: { transition, issueAndVerify } };
}

describe('archive-beta publication completion', () => {
  it('locks publication before issuing, including a future date', async () => {
    const s = setup();
    await transitionDailyLifecycleWithArchiveBeta(s.repository, input, s.dependencies);
    expect(s.events).toEqual(['publish', 'verify']);
    expect(s.issueAndVerify).toHaveBeenCalledWith({ seriesVersion: 'archive-beta-v1', puzzleDate: '2026-10-08', dailyNumber: 5 }, input.occurredAt);
  });
  it('never issues if the portable transition rejects', async () => {
    const s = setup('draft');
    s.transition.mockRejectedValueOnce(new Error('Only scheduled puzzles may be published'));
    await expect(transitionDailyLifecycleWithArchiveBeta(s.repository, input, s.dependencies)).rejects.toThrow('Only scheduled');
    expect(s.issueAndVerify).not.toHaveBeenCalled();
  });
  it('retries a failed copy without another publication revision or audit event', async () => {
    const s = setup();
    s.issueAndVerify.mockRejectedValueOnce(new Error('secret provider/answer payload'));
    await expect(transitionDailyLifecycleWithArchiveBeta(s.repository, input, s.dependencies)).rejects.toThrow('Published lineup archive copy could not be verified.');
    const firstPublished = s.getRecord();
    await transitionDailyLifecycleWithArchiveBeta(s.repository, { ...input, occurredAt: '2026-10-06T01:00:00.000Z' }, s.dependencies);
    expect(s.transition).toHaveBeenCalledTimes(1);
    expect(s.getRecord()).toEqual(firstPublished);
    expect(s.issueAndVerify).toHaveBeenCalledTimes(2);
  });
  it('recovers if publication commits but its horizon read fails', async () => {
    const s = setup();
    const transition = vi.fn(async () => {
      await s.transition();
      throw new Error('post-commit horizon read failed');
    });
    const dependencies = { ...s.dependencies, transition };
    await expect(transitionDailyLifecycleWithArchiveBeta(s.repository, input, dependencies)).rejects.toThrow('post-commit');
    expect(s.issueAndVerify).not.toHaveBeenCalled();
    await transitionDailyLifecycleWithArchiveBeta(s.repository, input, dependencies);
    expect(transition).toHaveBeenCalledOnce();
    expect(s.issueAndVerify).toHaveBeenCalledOnce();
    expect(s.getRecord().revision).toBe(3);
  });
  it('allows verification of an already published lineup', async () => {
    const s = setup('published');
    await transitionDailyLifecycleWithArchiveBeta(s.repository, input, s.dependencies);
    expect(s.transition).not.toHaveBeenCalled();
    expect(s.events).toEqual(['verify']);
  });
  it('leaves scheduling on the existing workflow without constructing issuers', async () => {
    const action = 'schedule' as const;
    const s = setup();
    await transitionDailyLifecycleWithArchiveBeta(s.repository, { ...input, action }, s.dependencies);
    expect(s.transition).toHaveBeenCalledOnce();
    expect(s.issueAndVerify).not.toHaveBeenCalled();
  });
  it('verifies before archiving a published lineup', async () => {
    const s = setup('published');
    await transitionDailyLifecycleWithArchiveBeta(s.repository, { ...input, action: 'archive' }, s.dependencies);
    expect(s.events).toEqual(['verify', 'archive']);
    expect(s.getRecord().status).toBe('archived');
    expect(s.transition).toHaveBeenCalledWith({ ...input, action: 'archive' });
  });
  it('preserves the published retry path when archive verification fails', async () => {
    const s = setup('published');
    s.issueAndVerify.mockRejectedValueOnce(new Error('read-back failed'));
    await expect(transitionDailyLifecycleWithArchiveBeta(s.repository, { ...input, action: 'archive' }, s.dependencies)).rejects.toMatchObject({ kind: 'verification-failed' });
    expect(s.transition).not.toHaveBeenCalled();
    expect(s.getRecord().status).toBe('published');
  });
  it('leaves invalid archive transitions authoritative without issuing', async () => {
    const s = setup('scheduled');
    s.transition.mockRejectedValueOnce(new Error('Only published puzzles may be archived'));
    await expect(transitionDailyLifecycleWithArchiveBeta(s.repository, { ...input, action: 'archive' }, s.dependencies)).rejects.toThrow('Only published');
    expect(s.issueAndVerify).not.toHaveBeenCalled();
  });
  it('preserves sanitized non-retryable immutable conflict classification', async () => {
    const s = setup('published');
    s.issueAndVerify.mockRejectedValueOnce(new ArchiveBetaActivationError('immutable-conflict'));
    await expect(transitionDailyLifecycleWithArchiveBeta(s.repository, input, s.dependencies)).rejects.toMatchObject({ kind: 'immutable-conflict' });
    expect(s.transition).not.toHaveBeenCalled();
  });
  it('keeps pre-epoch publication unchanged', async () => {
    const s = setup();
    await transitionDailyLifecycleWithArchiveBeta(s.repository, { ...input, puzzleDate: '2026-10-03' }, s.dependencies);
    expect(s.transition).toHaveBeenCalledOnce();
    expect(s.issueAndVerify).not.toHaveBeenCalled();
  });
  it('rejects invalid calendar dates before editorial/provider I/O', async () => {
    const s = setup();
    await expect(transitionDailyLifecycleWithArchiveBeta(s.repository, { ...input, puzzleDate: '2026-02-30' }, s.dependencies)).rejects.toThrow();
    expect(s.repository.getByDate).not.toHaveBeenCalled();
    expect(s.transition).not.toHaveBeenCalled();
    expect(s.issueAndVerify).not.toHaveBeenCalled();
  });
});
