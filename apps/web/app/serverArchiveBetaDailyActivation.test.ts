import { describe, expect, it, vi } from 'vitest';
import {
  createArchiveBetaDailyClueFrozenIssuedPuzzle,
  createPermanentDailyIssuedClueSnapshot,
} from '@initial-baseball/daily';

vi.mock('server-only', () => ({}));
import { issueActivatedArchiveBetaDaily } from './serverArchiveBetaDailyActivation';

const identity = { seriesVersion: 'archive-beta-v1' as const, puzzleDate: '2026-10-04', dailyNumber: 1 };
const ids = Array.from({ length: 9 }, (_, index) => `player-${index + 1}`);
const snapshot = createPermanentDailyIssuedClueSnapshot({
  hintLayout: [
    { slot: 1, hintType: 'main_decade', displayLabel: 'Decade' },
    { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
    { slot: 3, hintType: 'position', displayLabel: 'Position' },
    { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
  ],
  pitches: ids.map((canonicalPlayerId, index) => ({
    pitchNumber: index + 1, canonicalPlayerId, initials: 'AB', hintValues: ['2000s', 'NYY', 'CF', 'HR 1'],
  })),
});
const puzzle = createArchiveBetaDailyClueFrozenIssuedPuzzle({ identity, canonicalPlayerIds: ids, clueSnapshot: snapshot, issuedAt: '2026-10-05T00:00:00.000Z' });

function setup(status: 'created' | 'existing' = 'created') {
  const issue = vi.fn(async () => ({ ok: true as const, status, puzzle }));
  const getByDate = vi.fn(async () => puzzle);
  const getByNumber = vi.fn(async () => puzzle);
  return {
    issue, getByDate, getByNumber,
    dependencies: {
      now: () => new Date('2026-10-05T01:00:00.000Z'),
      createIssuance: vi.fn(() => ({ issue })),
      createReader: vi.fn(() => ({ getByDate, getByNumber })),
    },
  };
}

describe('explicit archive-beta activation', () => {
  it.each(['created', 'existing'] as const)('verifies both hosted identities and returns only metadata for %s', async status => {
    const s = setup(status);
    const result = await issueActivatedArchiveBetaDaily('2026-10-04', s.dependencies);
    expect(s.issue).toHaveBeenCalledWith({ identity, issuedAt: '2026-10-05T01:00:00.000Z' });
    expect(s.getByDate).toHaveBeenCalledWith({ seriesVersion: 'archive-beta-v1', puzzleDate: identity.puzzleDate });
    expect(s.getByNumber).toHaveBeenCalledWith({ seriesVersion: 'archive-beta-v1', dailyNumber: 1 });
    expect(result).toEqual({ status, puzzleDate: '2026-10-04', dailyNumber: 1, issuedAt: puzzle.issuedAt });
  });

  it.each(['2026-10-03', '2026-10-05', '2026-02-30', 'no-date'])('rejects %s before constructing providers', async date => {
    const s = setup();
    await expect(issueActivatedArchiveBetaDaily(date, s.dependencies)).rejects.toMatchObject({ kind: 'invalid-date' });
    expect(s.dependencies.createIssuance).not.toHaveBeenCalled();
    expect(s.dependencies.createReader).not.toHaveBeenCalled();
  });

  it('rejects conflict without attempting a read or exposing puzzle content', async () => {
    const s = setup();
    const dependencies = { ...s.dependencies, createIssuance: () => ({ issue: async () => ({ ok: false as const, error: 'immutable_conflict' as const, requested: puzzle, existing: puzzle }) }) };
    await expect(issueActivatedArchiveBetaDaily('2026-10-04', dependencies)).rejects.toMatchObject({ kind: 'immutable-conflict' });
    expect(s.dependencies.createReader).not.toHaveBeenCalled();
  });

  it('fails closed on missing read-back', async () => {
    const s = setup();
    const dependencies = { ...s.dependencies, createReader: () => ({ getByDate: async () => null, getByNumber: s.getByNumber }) };
    await expect(issueActivatedArchiveBetaDaily('2026-10-04', dependencies)).rejects.toMatchObject({ kind: 'read-back-failed' });
  });

  it('requires exact clues, order, and first timestamp in read-back', async () => {
    const s = setup();
    s.getByNumber.mockResolvedValueOnce({ ...puzzle, issuedAt: '2026-10-05T01:00:00.000Z' });
    await expect(issueActivatedArchiveBetaDaily('2026-10-04', s.dependencies)).rejects.toMatchObject({ kind: 'read-back-failed' });
  });
});
