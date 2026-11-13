import { DEFAULT_DAILY_HINT_CONFIG, DEFAULT_DAILY_STATS_HINT_CONFIG } from '@initial-baseball/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createOfficialDailyEditionHttpTransport,
  OfficialDailyEditionHttpError,
} from './officialDailyEditionHttpTransport';

const ID = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const OTHER = 'daily-ed-v1-6077ee21-9370-4cf3-aa21-74c50b485591';
const DATE = '2026-11-06';
const URL = '/api/daily/editions/' + ID + '/';
const bundle = {
  pitchNumber: 1, revealedCount: 0,
  hints: DEFAULT_DAILY_HINT_CONFIG.map(slot => ({
    slot: slot.slot, hintType: slot.hintType, hintLabel: slot.displayLabel,
    hintValue: 'CURRENT_BATTER_HINT_' + slot.slot,
  })),
  checkpoints: [1, 2, 3, 4].map(revealedCount => ({
    revealedCount, progressionToken: 'signed-current-' + revealedCount,
  })),
};
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
function publicReveal() {
  return {
    playerId: 'ibp_ab000000000000000000', displayName: 'Test Player',
    playerType: 'hitter', primaryPosition: 'CF', yearsPlayedDisplay: '1995–2004',
    teamIds: ['NYM'],
    career: { lines: [{ kind: 'hitter', stats: {
      AB: 500, H: 140, HR: 20, BA: '.280', R: 80, RBI: 70, SB: 8,
      OBP: '.340', SLG: '.450', OPS: '.790',
    } }] },
    seasons: [],
  };
}

function setup(initial: unknown = bootstrap()) {
  const get = vi.fn(async () => initial);
  const post = vi.fn(async (path: string, _body: Record<string, unknown>): Promise<unknown> =>
    path.endsWith('/hint')
      ? { hint: { hintType: 'main_decade',
          hintLabel: DEFAULT_DAILY_HINT_CONFIG[0]!.displayLabel,
          hintValue: 'AUTHORIZED_FIRST_HINT' }, progressionToken: 'signed-next' }
      : { hintBundle: bundle });
  return { get, post, transport: createOfficialDailyEditionHttpTransport(ID, get, post) };
}

afterEach(() => vi.unstubAllGlobals());

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
    expect(result.hintBundle.hints).toHaveLength(4);
    expect(result.hintBundle.checkpoints.map(checkpoint => checkpoint.revealedCount)).toEqual([1, 2, 3, 4]);
    expect(JSON.stringify(result)).not.toContain('canonicalPlayerIds');
    expect(JSON.stringify(result)).not.toContain('PRIVATE_FUTURE_HINT');
  });

  it('accepts current-batter hints, rejects sibling editions and future-answer fields', async () => {
    const cases = [
      bootstrap(OTHER),
      bootstrap(ID, '2026-11-05'),
      { ...bootstrap(), puzzle: { ...bootstrap().puzzle, puzzleNumber: { answers: ['PRIVATE_FUTURE_HINT'] } } },
      { ...bootstrap(), puzzle: { ...bootstrap().puzzle, status: { answers: ['PRIVATE_FUTURE_HINT'] } } },
      { ...bootstrap(), puzzle: { ...bootstrap().puzzle, puzzleNumber: 0 } },
      { ...bootstrap(), puzzle: { ...bootstrap().puzzle, puzzleNumber: Number.MAX_SAFE_INTEGER + 1 } },
      { ...bootstrap(), puzzle: { ...bootstrap().puzzle, status: 'draft' } },
      { ...bootstrap(), puzzle: { ...bootstrap().puzzle, status: 'scheduled' } },
      { ...bootstrap(), puzzle: { ...bootstrap().puzzle, answers: ['PRIVATE_FUTURE_HINT'] } },
      { ...bootstrap(), puzzle: { ...bootstrap().puzzle,
        pitches: [{ ...bootstrap().puzzle.pitches[0], fullName: 'PRIVATE_FUTURE_HINT' },
          ...bootstrap().puzzle.pitches.slice(1)] } },
      { ...bootstrap(), hintBundle: { ...bundle, checkpoints: [{ revealedCount: 1, progressionToken: 'PRIVATE' }] } },
      { ...bootstrap(), hintBundle: { ...bundle, checkpoints: [...bundle.checkpoints, { revealedCount: 5, progressionToken: 'FUTURE' }] } },
      { ...bootstrap(), hintBundle: { ...bundle, hints: [...bundle.hints, { ...bundle.hints[0], slot: 5 }] } },
      { ...bootstrap(), hintBundle: { ...bundle, hints: ['PRIVATE_FUTURE_HINT'] } },
      { ...bootstrap(), futureHints: ['PRIVATE_FUTURE_HINT'] },
    ];
    for (const value of cases) {
      const { transport } = setup(value);
      await expect(transport.bootstrap(DATE)).rejects.toThrow(/incompatible/i);
    }
  });

  it('rejects answers injected into nested public configuration objects', async () => {
    const base = bootstrap();
    const cases = [
      { ...base, puzzle: { ...base.puzzle,
        hintConfig: base.puzzle.hintConfig.map((entry, index) =>
          index === 0 ? { ...entry, answers: ['PRIVATE_FUTURE_HINT'] } : entry) } },
      { ...base, puzzle: { ...base.puzzle,
        statsHintConfig: { ...base.puzzle.statsHintConfig, answers: ['PRIVATE_FUTURE_HINT'] } } },
      { ...base, puzzle: { ...base.puzzle,
        statsHintConfig: { ...base.puzzle.statsHintConfig, hitter: [{ stat: 'hr', answer: 'PRIVATE_FUTURE_HINT' }] } } },
      { ...base, puzzle: { ...base.puzzle,
        hintConfig: [{ ...base.puzzle.hintConfig[0]!, displayLabel: 'Safe', hintValue: 'PRIVATE_FUTURE_HINT' },
          ...base.puzzle.hintConfig.slice(1)] } },
    ];
    for (const value of cases) {
      const { transport } = setup(value);
      await expect(transport.bootstrap(DATE)).rejects.toThrow(/incompatible/i);
    }
  });

  it('accepts one authorized hint but rejects extra future clues or checkpoints', async () => {
    const { transport, post } = setup();
    const valid = await transport.hint('signed-start');
    expect(valid.hint.hintValue).toBe('AUTHORIZED_FIRST_HINT');
    expect(valid.progressionToken).toBe('signed-next');
    expect(Object.keys(valid).sort()).toEqual(['hint', 'progressionToken']);
    const cases = [
      { ...valid, checkpoints: [{ revealedCount: 4, progressionToken: 'FUTURE' }] },
      { ...valid, futureHints: ['PRIVATE_FUTURE_HINT'] },
      { ...valid, hint: { ...valid.hint, answer: 'PRIVATE_FUTURE_HINT' } },
      { ...valid, hint: { ...valid.hint, hintType: 'unknown' } },
      { ...valid, hint: { ...valid.hint, hintValue: '' } },
      { ...valid, progressionToken: '' },
    ];
    for (const value of cases) {
      post.mockResolvedValueOnce(value);
      await expect(transport.hint('signed-start')).rejects.toThrow(/incompatible/i);
    }
  });

  it('categorizes bootstrap 404, provider outage, network failure and malformed JSON safely', async () => {
    const transport = createOfficialDailyEditionHttpTransport(ID);
    for (const [status, kind] of [[404, 'not_found'], [503, 'unavailable']] as const) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(
        JSON.stringify({ error: 'PRIVATE_PROVIDER_MESSAGE' }), { status },
      )));
      await expect(transport.bootstrap(DATE)).rejects.toMatchObject({
        name: 'OfficialDailyEditionHttpError', kind,
        message: 'Official Daily edition request failed.',
      });
    }
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('PRIVATE_NETWORK_TOKEN'); }));
    await expect(transport.bootstrap(DATE)).rejects.toMatchObject({
      kind: 'unavailable', message: 'Official Daily edition request failed.',
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{bad json', { status: 200 })));
    await expect(transport.bootstrap(DATE)).rejects.toMatchObject({
      kind: 'invalid_response', message: 'Official Daily edition request failed.',
    });
    expect(new OfficialDailyEditionHttpError('unavailable').message).not.toContain('PRIVATE');
  });

  it('preserves sanitized POST status and network failures across the exact-ID endpoint', async () => {
    const transport = createOfficialDailyEditionHttpTransport(ID);
    for (const [status, kind] of [[400, 'invalid_request'], [404, 'not_found'], [503, 'unavailable']] as const) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(
        JSON.stringify({ error: 'PRIVATE_DB_CREDENTIAL' }), { status },
      )));
      await expect(transport.hint('signed-start')).rejects.toMatchObject({
        name: 'OfficialDailyEditionHttpError', kind,
        message: 'Official Daily edition request failed.',
      });
    }
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('PRIVATE_NETWORK_TOKEN'); }));
    await expect(transport.hint('signed-start')).rejects.toMatchObject({
      kind: 'unavailable', message: 'Official Daily edition request failed.',
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{', { status: 200 })));
    await expect(transport.hint('signed-start')).rejects.toMatchObject({
      kind: 'invalid_response', message: 'Official Daily edition request failed.',
    });
  });

  it('uses same-origin JSON POST and accepts a valid exact-ID hint response', async () => {
    const payload = {
      hint: { hintType: 'main_decade', hintLabel: DEFAULT_DAILY_HINT_CONFIG[0]!.displayLabel,
        hintValue: 'AUTHORIZED_FIRST_HINT' },
      progressionToken: 'signed-next',
    };
    const send = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal('fetch', send);
    const transport = createOfficialDailyEditionHttpTransport(ID);
    expect(await transport.hint('signed-start')).toEqual(payload);
    expect(send).toHaveBeenCalledWith(URL + 'hint', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ progressionToken: 'signed-start' }),
    });
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
      result: { kind: 'incorrect', revealedCount: 0, strikeCount: 1, remainingStrikes: 2 },
      reveal: null, progressionToken: 'next',
      hintBundle: bundle,
    });
    await transport.resolve({ progressionToken: 'signed-after', submittedPlayerId: 'ibp_ab000000000000000000' });
    expect(post).toHaveBeenCalledWith(URL + 'resolve', {
      progressionToken: 'signed-after', submittedPlayerId: 'ibp_ab000000000000000000',
    });
    post.mockResolvedValueOnce({
      result: { kind: 'strikeout', revealedCount: 0, strikeCount: 3, outcome: 'K', source: 'strikeout' },
      reveal: publicReveal(), progressionToken: 'next',
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

  it('restores a revealed current batter with only remaining signed checkpoints', async () => {
    const { transport, post } = setup();
    const resumed = {
      ...bundle, revealedCount: 2, checkpoints: bundle.checkpoints.slice(2),
    };
    post.mockResolvedValueOnce({ hintBundle: resumed });
    expect((await transport.hints('signed-after-2')).hintBundle).toEqual(resumed);
    for (const malformed of [
      { ...resumed, checkpoints: bundle.checkpoints },
      { ...resumed, hints: bundle.hints.slice(0, 2) },
      { ...resumed, checkpoints: [{ ...resumed.checkpoints[0], revealedCount: 4 }, resumed.checkpoints[1]] },
      { ...resumed, hints: [{ ...bundle.hints[0], playerId: 'SECRET_ANSWER' }, ...bundle.hints.slice(1)] },
    ]) {
      post.mockResolvedValueOnce({ hintBundle: malformed });
      await expect(transport.hints('signed-after-2')).rejects.toThrow(/incompatible/i);
    }
  });

  it('accepts a canonical public terminal reveal without hidden answer fields', async () => {
    const { transport, post } = setup();
    const result = {
      result: { kind: 'correct', revealedCount: 0, outcome: 'HR', source: 'initials' },
      reveal: publicReveal(), progressionToken: 'successor', hintBundle: null,
    };
    post.mockResolvedValueOnce(result);
    expect(await transport.resolve({ progressionToken: 'signed', submittedPlayerId: 'ibp_ab000000000000000000' }))
      .toEqual(result);
  });

  it('rejects unexpected answer-bearing fields in incorrect and terminal results', async () => {
    const { transport, post } = setup();
    const incorrect = {
      result: { kind: 'incorrect', revealedCount: 0, strikeCount: 1, remainingStrikes: 2 },
      reveal: null, progressionToken: 'successor', hintBundle: bundle,
    };
    const correct = {
      result: { kind: 'correct', revealedCount: 0, outcome: 'HR', source: 'initials' },
      reveal: publicReveal(), progressionToken: 'successor', hintBundle: null,
    };
    const malformed = [
      { ...incorrect, reveal: publicReveal() },
      { ...incorrect, result: { ...incorrect.result, futureAnswers: ['PRIVATE_FUTURE_HINT'] } },
      { ...correct, reveal: { ...publicReveal(), futureAnswers: ['PRIVATE_FUTURE_HINT'] } },
      { ...correct, reveal: { ...publicReveal(),
        career: { ...publicReveal().career, hiddenRoster: ['PRIVATE_FUTURE_HINT'] } } },
      { ...correct, reveal: { ...publicReveal(),
        career: { lines: [{ kind: 'hitter', stats: {
          ...publicReveal().career.lines[0]!.stats,
          FUTURE_HINT: 'PRIVATE_FUTURE_HINT',
        } }] } } },
    ];
    for (const value of malformed) {
      post.mockResolvedValueOnce(value);
      await expect(transport.resolve({ progressionToken: 'signed', giveUp: true }))
        .rejects.toThrow(/incompatible/i);
    }
  });

  it('does not return unsafe future checkpoint bundles from resolution', async () => {
    const { transport, post } = setup();
    post.mockResolvedValueOnce({
      result: { kind: 'correct', revealedCount: 0, outcome: 'HR', source: 'initials' },
      reveal: publicReveal(), progressionToken: 'successor',
      hintBundle: { ...bundle, futureBatter: { correctPlayerId: 'SECRET' } },
    });
    await expect(transport.resolve({ progressionToken: 'x', giveUp: true }))
      .rejects.toThrow(/incompatible/i);
  });
});
