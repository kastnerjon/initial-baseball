import { describe, expect, it, vi } from 'vitest';
import { createCustomNineIssuedChallenge } from './customNineIssuedChallenge';
import type { CustomNineIssuedChallengeRepository } from './customNineIssuedChallengeService';
import { createCustomNineIssuedChallengeService } from './customNineIssuedChallengeService';
import { fixture, ID } from './customNineIssuedChallenge.test';

function repo(): CustomNineIssuedChallengeRepository {
  return {
    insertIfAbsent: vi.fn().mockImplementation(async challenge => ({ status: 'inserted', challenge })),
    getById: vi.fn().mockResolvedValue(null),
  };
}

describe('Custom Nine first-write-wins service', () => {
  it('issues new records and reads them through a private provider port', async () => {
    const provider = repo();
    const service = createCustomNineIssuedChallengeService(provider);
    await expect(service.issue(fixture())).resolves.toMatchObject({
      ok: true, status: 'created', challenge: { puzzleId: ID },
    });
    expect(provider.insertIfAbsent).toHaveBeenCalledTimes(1);
    vi.mocked(provider.getById).mockResolvedValueOnce(createCustomNineIssuedChallenge(fixture()));
    const loaded = await service.getById(ID);
    expect(loaded?.puzzleId).toBe(ID);
    expect(loaded?.clueSnapshot.pitches).toHaveLength(9);
    expect(loaded).not.toBe(await Promise.resolve(vi.mocked(provider.insertIfAbsent).mock.results[0]?.value));
  });

  it('treats identical retries as existing and preserves the original issue time', async () => {
    const provider = repo();
    const first = createCustomNineIssuedChallenge(fixture());
    vi.mocked(provider.insertIfAbsent).mockResolvedValue({ status: 'existing', challenge: first });
    const result = await createCustomNineIssuedChallengeService(provider).issue({
      ...fixture(), issuedAt: '2026-10-10T05:00:00Z',
    });
    expect(result).toMatchObject({ ok: true, status: 'existing', challenge: { issuedAt: first.issuedAt } });
  });

  it('fails closed on changed player order, hints, wrong IDs or schema collision', async () => {
    const provider = repo();
    const first = createCustomNineIssuedChallenge(fixture());
    vi.mocked(provider.insertIfAbsent).mockResolvedValue({ status: 'existing', challenge: first });
    await expect(createCustomNineIssuedChallengeService(provider).issue({
      ...fixture(), canonicalPlayerIds: [...fixture().canonicalPlayerIds].reverse(),
      clueSnapshot: { ...fixture().clueSnapshot, pitches: [...fixture().clueSnapshot.pitches].reverse() },
    })).rejects.toThrow('exact pitch order');
    const input = fixture();
    const differentClue = createCustomNineIssuedChallenge({
      ...input, clueSnapshot: {
        ...input.clueSnapshot,
        pitches: input.clueSnapshot.pitches.map((pitch, index) => index === 0
          ? { ...pitch, hintValues: ['1990s', ...pitch.hintValues.slice(1)] } : pitch),
      },
    });
    vi.mocked(provider.insertIfAbsent).mockResolvedValueOnce({ status: 'existing', challenge: differentClue });
    await expect(createCustomNineIssuedChallengeService(provider).issue(fixture()))
      .resolves.toEqual({ ok: false, error: 'immutable_conflict' });
    const wrongId = createCustomNineIssuedChallenge({
      ...fixture(), puzzleId: 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001',
    });
    vi.mocked(provider.insertIfAbsent).mockResolvedValueOnce({ status: 'existing', challenge: wrongId });
    await expect(createCustomNineIssuedChallengeService(provider).issue(fixture()))
      .resolves.toEqual({ ok: false, error: 'immutable_conflict' });
  });

  it('rejects a mismatching inserted result and a wrong record returned by lookup', async () => {
    const provider = repo();
    const wrong = createCustomNineIssuedChallenge({
      ...fixture(), puzzleId: 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001',
    });
    vi.mocked(provider.insertIfAbsent).mockResolvedValue({ status: 'inserted', challenge: wrong });
    await expect(createCustomNineIssuedChallengeService(provider).issue(fixture()))
      .rejects.toThrow('did not preserve');
    vi.mocked(provider.getById).mockResolvedValueOnce(wrong);
    await expect(createCustomNineIssuedChallengeService(provider).getById(ID))
      .rejects.toThrow('wrong challenge');
    await expect(createCustomNineIssuedChallengeService(provider).getById('bad'))
      .rejects.toThrow('Invalid Custom Nine puzzle ID');
    expect(provider.getById).toHaveBeenCalledTimes(1);
  });
});
