import { DEFAULT_DAILY_HINT_CONFIG, DEFAULT_DAILY_STATS_HINT_CONFIG } from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import { createOfficialDailyEditionHttpTransport } from './officialDailyEditionHttpTransport';

const ID = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const OTHER = 'daily-ed-v1-6077ee21-9370-4cf3-aa21-74c50b485591';
const DATE = '2026-11-06';
const URL = '/api/daily/editions/' + ID + '/';
const bundle = { pitchNumber: 1, revealedCount: 0, hints: [], checkpoints: [] };
function bootstrap(id = ID, date = DATE) {
  return {
    rulesetVersion: 'points-v4', progressionToken: 'signed-start',
    puzzle: {
      id, puzzleDate: date, puzzleNumber: 194, status: 'published',
      hintConfig: DEFAULT_DAILY_HINT_CONFIG, statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
      pitches: Array.from({ length: 9 }, (_, index) => ({
        pitchNumber: index + 1, initials: 'PP',
      })),
    }, hintBundle: bundle,
  };
}
function setup(initial: unknown = bootstrap()) {
  const get = vi.fn(async () => initial);
  const post = vi.fn(async (_path: string, _body: Record<string, unknown>): Promise<unknown> => ({ hintBundle: bundle }));
  return { get, post, transport: createOfficialDailyEditionHttpTransport(ID, get, post) };
}

describe('source-staged official Daily exact-ID browser HTTP transport', () => {
  it('rejects invalid IDs before constructing any URL or making I/O', () => {
    for (const id of ['', 'daily-2026-11-06', '../api/daily/resolve', 'daily-ed-v1-NOT-UUID', 'daily-ed-v1-907F33DB-c38f-43c3-8e6b-a3aaf19bbd08']) {
      expect(() => createOfficialDailyEditionHttpTransport(id)).toThrow(/incompatible/i);
    }
  });

  it('bootstraps only the bound edition with a strict answer-free payload', async () => {
    const { transport, get } = setup();
    const result = await transport.bootstrap(DATE);
    expect(get).toHaveBeenCalledWith(URL + 'bootstrap?date=' + DATE);
    expect(result.puzzle.id).toBe(ID);
    expect(result.hintBundle).toEqual(bundle);
    expect(JSON.stringify(result)).not.toContain('canonicalPlayerIds');
    expect(JSON.stringify(result)).not.toContain('PRIVATE_FUTURE_HINT');
  });

  it('rejects a sibling edition, wrong date or any preloaded answer fields', async () => {
    const cases = [
      bootstrap(OTHER),
      bootstrap(ID, '2026-11-05'),
      { ...bootstrap(), puzzle: { ...bootstrap().puzzle, answers: ['PRIVATE_FUTURE_HINT'] } },
      { ...bootstrap(), puzzle: { ...bootstrap().puzzle,
        pitches: [{ ...bootstrap().puzzle.pitches[0], fullName: 'PRIVATE_FUTURE_HINT' },
          ...bootstrap().puzzle.pitches.slice(1)] } },
      { ...bootstrap(), hintBundle: { ...bundle, checkpoints: [{ revealedCount: 1, progressionToken: 'PRIVATE' }] } },
      { ...bootstrap(), hintBundle: { ...bundle, hints: ['PRIVATE_FUTURE_HINT'] } },
      { ...bootstrap(), futureHints: ['PRIVATE_FUTURE_HINT'] },
    ];
    for (const value of cases) {
      const { transport } = setup(value);
      await expect(transport.bootstrap(DATE)).rejects.toThrow(/incompatible/i);
    }
  });

  it('rejects invalid dates before requesting any bootstrap response', async () => {
    const { transport, get } = setup();
    for (const date of ['2026-02-30', '2026-11-06?includeAnswers=1', '', '2026-11-06/../07']) {
      await expect(transport.bootstrap(date)).rejects.toThrow(/incompatible/i);
    }
    expect(get).not.toHaveBeenCalled();
  });

  it('binds hint, resume and resolve requests to exact-ID endpoints, never legacy', async () => {
    const { transport, post } = setup();
    await transport.hint('signed-start');
    expect(post).toHaveBeenCalledWith(URL + 'hint', { progressionToken: 'signed-start' });
    await transport.hints('signed-after');
    expect(post).toHaveBeenCalledWith(URL + 'hints', { progressionToken: 'signed-after' });
    post.mockResolvedValueOnce({
      result: { kind: 'incorrect' }, reveal: null, progressionToken: 'next',
      hintBundle: bundle,
    });
    await transport.resolve({ progressionToken: 'signed-after', submittedPlayerId: 'ibp_ab000000000000000000' });
    expect(post).toHaveBeenCalledWith(URL + 'resolve', {
      progressionToken: 'signed-after', submittedPlayerId: 'ibp_ab000000000000000000',
    });
    post.mockResolvedValueOnce({
      result: { kind: 'strikeout' }, reveal: null, progressionToken: 'next',
      hintBundle: null,
    });
    await transport.resolve({ progressionToken: 'signed-after', giveUp: true });
    expect(post).toHaveBeenCalledWith(URL + 'resolve', {
      progressionToken: 'signed-after', giveUp: true,
    });
    expect(post.mock.calls.flat().join(' ')).not.toContain('/api/daily/resolve ');
  });

  it('fails closed before I/O for invalid tokens and response bundles', async () => {
    const { transport, post } = setup();
    await expect(transport.hint('')).rejects.toThrow(/incompatible/i);
    await expect(transport.hints('')).rejects.toThrow(/incompatible/i);
    await expect(transport.resolve({ progressionToken: 'x', submittedPlayerId: '' }))
      .rejects.toThrow(/incompatible/i);
    expect(post).not.toHaveBeenCalled();
    post.mockResolvedValueOnce({ hintBundle: { ...bundle, checkpoints: [{ revealedCount: 1, progressionToken: 'FUTURE' }] } });
    await expect(transport.hints('x')).rejects.toThrow(/incompatible/i);
  });

  it('does not return unsafe future checkpoint bundles from resolution', async () => {
    const { transport, post } = setup();
    post.mockResolvedValueOnce({
      result: { kind: 'correct' }, reveal: null, progressionToken: 'successor',
      hintBundle: { ...bundle, hints: [{ slot: 1, hintType: 'stats', hintLabel: 'Stats', hintValue: 'PRIVATE_FUTURE_HINT' }] },
    });
    await expect(transport.resolve({ progressionToken: 'x', giveUp: true }))
      .rejects.toThrow(/incompatible/i);
  });
});
