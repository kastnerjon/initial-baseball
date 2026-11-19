import { DEFAULT_DAILY_HINT_CONFIG, DEFAULT_DAILY_STATS_HINT_CONFIG } from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import { createOfficialDailyCompetitiveHttpTransport } from './officialDailyCompetitiveHttpTransport';
import {
  OfficialDailyEditionHttpError,
  validateOfficialDailyEditionBootstrap,
} from './officialDailyEditionHttpTransport';

const ID = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const SIBLING = 'daily-ed-v1-6077ee21-9370-4cf3-aa21-74c50b485591';
const DATE = '2026-11-18';
const URL = '/api/daily/editions/' + ID + '/competitive/';

function bundle(pitchNumber = 1, revealedCount = 0) {
  return {
    pitchNumber, revealedCount,
    hints: DEFAULT_DAILY_HINT_CONFIG.map(slot => ({
      slot: slot.slot, hintType: slot.hintType, hintLabel: slot.displayLabel,
      hintValue: 'CURRENT_BATTER_ONLY_' + slot.slot,
    })),
    checkpoints: Array.from({ length: 4 - revealedCount }, (_, index) => ({
      revealedCount: revealedCount + index + 1,
      progressionToken: 'signed-checkpoint-' + (revealedCount + index + 1),
    })),
  };
}
function bootstrap(pitchNumber = 1, revealedCount = 0, id = ID) {
  return {
    rulesetVersion: 'points-v4', progressionToken: 'signed-start-or-resume',
    puzzle: {
      id, puzzleDate: DATE, puzzleNumber: 206, status: 'published',
      hintConfig: DEFAULT_DAILY_HINT_CONFIG, statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
      pitches: Array.from({ length: 9 }, (_, index) => ({
        pitchNumber: index + 1, initials: 'PP',
      })),
    },
    hintBundle: bundle(pitchNumber, revealedCount),
  };
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status, headers: { 'content-type': 'application/json' },
  });
}

describe('isolated competitive Daily browser client', () => {
  it('confirms first-contact HttpOnly cookie through one bounded 428 retry before bootstrap', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ error: 'cookie_required' }, 428))
      .mockResolvedValueOnce(json(bootstrap()));
    const transport = createOfficialDailyCompetitiveHttpTransport(ID, fetcher);
    expect(await transport.bootstrap(DATE)).toEqual(bootstrap());
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetcher.mock.calls) {
      expect(url).toBe(URL + 'bootstrap');
      expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date: DATE }) });
    }
  });

  it('accepts valid same-cookie and later-batter resume, unlike first-start-only practice', async () => {
    const resumed = bootstrap(3, 2);
    const fetcher = vi.fn().mockResolvedValue(json(resumed));
    expect(await createOfficialDailyCompetitiveHttpTransport(ID, fetcher).bootstrap(DATE))
      .toEqual(resumed);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(() => validateOfficialDailyEditionBootstrap(resumed, ID, DATE)).toThrow();
  });

  it('rejects malformed 428 protocol, two 428 responses, missing cookie and unexpected errors', async () => {
    for (const first of [json({ error: 'something_else' }, 428),
      json({ error: 'cookie_required', extra: true }, 428),
      new Response('not json', { status: 428 })]) {
      const fetcher = vi.fn().mockResolvedValue(first);
      await expect(createOfficialDailyCompetitiveHttpTransport(ID, fetcher).bootstrap(DATE))
        .rejects.toBeInstanceOf(OfficialDailyEditionHttpError);
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
    const repeated = vi.fn().mockResolvedValue(json({ error: 'cookie_required' }, 428));
    await expect(createOfficialDailyCompetitiveHttpTransport(ID, repeated).bootstrap(DATE))
      .rejects.toMatchObject({ kind: 'unavailable' });
    expect(repeated).toHaveBeenCalledTimes(2);
    for (const status of [403, 404, 503]) {
      const fetcher = vi.fn().mockResolvedValue(json({ error: 'unavailable' }, status));
      await expect(createOfficialDailyCompetitiveHttpTransport(ID, fetcher).bootstrap(DATE))
        .rejects.toBeInstanceOf(OfficialDailyEditionHttpError);
    }
    const network = vi.fn().mockRejectedValue(new Error('private connection information'));
    await expect(createOfficialDailyCompetitiveHttpTransport(ID, network).bootstrap(DATE))
      .rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('rejects foreign edition, future hints and malformed current-batter contracts', async () => {
    const bad = [
      bootstrap(2, 1, SIBLING),
      { ...bootstrap(), puzzle: { ...bootstrap().puzzle, pitches: [
        { pitchNumber: 1, initials: 'PP', answer: 'SECRET' },
        ...bootstrap().puzzle.pitches.slice(1),
      ] } },
      { ...bootstrap(), hintBundle: { ...bundle(2), hints: [...bundle(2).hints,
        { slot: 5, hintValue: 'FUTURE' }] } },
      { ...bootstrap(), hintBundle: { ...bundle(5), checkpoints: [{ revealedCount: 5, progressionToken: 'bad' }] } },
      { ...bootstrap(), hintBundle: { ...bundle(2), revealedCount: 5 } },
      { ...bootstrap(), extra: { futurePlayer: 'SECRET' } },
    ];
    for (const value of bad) {
      await expect(createOfficialDailyCompetitiveHttpTransport(ID, vi.fn().mockResolvedValue(json(value)))
        .bootstrap(DATE)).rejects.toThrow(/incompatible/i);
    }
  });

  it('posts hints and resolutions only to the exact edition path with no client score authority', async () => {
    const response = {
      result: { kind: 'incorrect', revealedCount: 0, strikeCount: 1, remainingStrikes: 2 },
      reveal: null, progressionToken: 'signed-after-incorrect', hintBundle: bundle(),
    };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ hintBundle: bundle() }))
      .mockResolvedValueOnce(json(response))
      .mockResolvedValueOnce(json(response));
    const transport = createOfficialDailyCompetitiveHttpTransport(ID, fetcher);
    expect(await transport.hints('signed')).toEqual({ hintBundle: bundle() });
    expect(await transport.resolve({ progressionToken: 'signed', submittedPlayerId: 'ibp_1' }))
      .toEqual(response);
    expect(await transport.resolve({ progressionToken: 'signed', giveUp: true }))
      .toEqual(response);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      URL + 'hints', URL + 'resolve', URL + 'resolve',
    ]);
    expect(fetcher.mock.calls[1]![1].body).toBe(JSON.stringify({
      progressionToken: 'signed', submittedPlayerId: 'ibp_1',
    }));
    expect(fetcher.mock.calls[2]![1].body).toBe(JSON.stringify({
      progressionToken: 'signed', giveUp: true,
    }));
  });

  it('fails closed before fetch for invalid edition, date, token or submitted ID', async () => {
    const fetcher = vi.fn();
    expect(() => createOfficialDailyCompetitiveHttpTransport('daily-other', fetcher))
      .toThrow();
    const transport = createOfficialDailyCompetitiveHttpTransport(ID, fetcher);
    await expect(transport.bootstrap('2026-02-30')).rejects.toThrow();
    await expect(transport.hints('')).rejects.toThrow();
    await expect(transport.resolve({ progressionToken: 'signed', submittedPlayerId: '' }))
      .rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects answer-bearing hint and response shapes even on HTTP 200', async () => {
    const transport = createOfficialDailyCompetitiveHttpTransport(ID,
      vi.fn().mockResolvedValue(json({ hintBundle: { ...bundle(), future: 'SECRET' } })));
    await expect(transport.hints('signed')).rejects.toThrow(/incompatible/i);
  });
});
