import { describe, expect, it, vi } from 'vitest';
import {
  createDailyNineLeaderboardService,
  type DailyNineLeaderboardRepository,
  type LeaderboardIdentity,
} from './dailyNineLeaderboardService';

const IDENTITY: LeaderboardIdentity = {
  puzzleId: 'daily-2026-10-08-editorial-v1',
  puzzleDate: '2026-10-08',
  puzzleNumber: 165,
  rulesetVersion: 'points-v4',
};

function fakeRepository(): DailyNineLeaderboardRepository {
  return {
    findCompletion: vi.fn().mockResolvedValue({ ...IDENTITY, submissionId: 'attempt1' }),
    insertName: vi.fn().mockResolvedValue('created'),
    read: vi.fn().mockResolvedValue([
      { displayName: 'Alice', points: 35.5, rank: 1, isOwnEntry: false, totalEntries: 12 },
      { displayName: 'Bob', points: 35.5, rank: 1, isOwnEntry: false, totalEntries: 12 },
      { displayName: 'Chris', points: 34, rank: 3, isOwnEntry: true, totalEntries: 12 },
    ]),
  };
}

describe('Daily Nine leaderboard submission and read orchestration', () => {
  it('reads one exact points-v4 puzzle and keeps proper tied ranks', async () => {
    const repo = fakeRepository();
    const service = createDailyNineLeaderboardService(repo);
    await expect(service.read(IDENTITY)).resolves.toEqual({
      ok: true,
      value: {
        totalEntries: 12,
        leaders: [
          { displayName: 'Alice', points: 35.5, rank: 1 },
          { displayName: 'Bob', points: 35.5, rank: 1 },
          { displayName: 'Chris', points: 34, rank: 3 },
        ],
        ownEntry: { displayName: 'Chris', points: 34, rank: 3 },
      },
    });
    expect(repo.read).toHaveBeenCalledWith(IDENTITY, null);
  });

  it('requires a valid name and a pre-existing completed result before naming', async () => {
    const repo = fakeRepository();
    const service = createDailyNineLeaderboardService(repo);
    await expect(service.submit({ submissionId: 'attempt1', displayName: ' \n ' }))
      .resolves.toEqual({ ok: false, error: 'invalid_request' });
    await expect(service.submit({ submissionId: 'attempt1', displayName: '  Yoni  ' }))
      .resolves.toMatchObject({ ok: true });
    expect(repo.insertName).toHaveBeenCalledWith('attempt1', 'Yoni');
    expect(repo.read).toHaveBeenCalledWith(IDENTITY, 'attempt1');
  });

  it('rejects unsupported history and rejects missing or conflicting first-write names', async () => {
    const repo = fakeRepository();
    const service = createDailyNineLeaderboardService(repo);
    vi.mocked(repo.findCompletion).mockResolvedValueOnce(null);
    await expect(service.submit({ submissionId: 'attempt1', displayName: 'Yoni' }))
      .resolves.toEqual({ ok: false, error: 'not_eligible' });
    vi.mocked(repo.findCompletion).mockResolvedValueOnce({
      ...IDENTITY, puzzleId: 'archive-beta-v1-daily-20', submissionId: 'attempt1',
    });
    await expect(service.submit({ submissionId: 'attempt1', displayName: 'Yoni' }))
      .resolves.toEqual({ ok: false, error: 'not_eligible' });
    vi.mocked(repo.insertName).mockResolvedValueOnce('conflict');
    await expect(service.submit({ submissionId: 'attempt1', displayName: 'Yoni' }))
      .resolves.toEqual({ ok: false, error: 'name_conflict' });
  });

  it('reads personal rank only through an explicit submission ID, without exposing IDs', async () => {
    const repo = fakeRepository();
    vi.mocked(repo.read).mockResolvedValueOnce([
      { displayName: 'Alice', points: 36, rank: 1, isOwnEntry: false, totalEntries: 150 },
      { displayName: 'Me', points: 10, rank: 48, isOwnEntry: true, totalEntries: 150 },
    ]);
    const result = await createDailyNineLeaderboardService(repo).rank({ submissionId: 'attempt1' });
    expect(result).toMatchObject({ ok: true, value: { ownEntry: { rank: 48 } } });
    expect(JSON.stringify(result)).not.toContain('attempt1');
  });

  it('rejects invalid puzzle identity and hides non-v4 data', async () => {
    const repo = fakeRepository();
    const svc = createDailyNineLeaderboardService(repo);
    await expect(svc.read({ ...IDENTITY, puzzleDate: '2026-02-30' }))
      .resolves.toEqual({ ok: false, error: 'invalid_request' });
    await expect(svc.read({ ...IDENTITY, rulesetVersion: 'classic-inning-v1' }))
      .resolves.toEqual({ ok: false, error: 'invalid_request' });
    expect(repo.read).not.toHaveBeenCalled();
  });
});
