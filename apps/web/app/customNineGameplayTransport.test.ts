import { describe, expect, it, vi } from 'vitest';
import {
  CustomNineBrowserTransportError, createCustomNineBrowserTransport,
} from './customNineGameplayTransport';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const pitchers = Array.from({ length: 9 }, (_, index) => ({
  pitchNumber: index + 1, initials: 'P' + (index + 1),
}));
const fact = {
  pitchNumber: 1, initials: 'P1', outcome: 'HR', hintsRevealed: 0,
  wrongGuesses: 0, resolution: 'correct',
};
const hint = { slot: 1, hintType: 'main_decade', hintLabel: 'Era', hintValue: '2020s' };
const reveal = {
  playerId: 'ibp_example', displayName: 'Example Player', playerType: 'hitter',
  primaryPosition: 'LF', yearsPlayedDisplay: '2020–2026', teamIds: ['NYM'],
  career: { lines: [{ kind: 'hitter', stats: { HR: 10, OPS: '.900' } }] }, seasons: [],
};
const bundle = { pitchNumber: 1, revealedCount: 0, hints: [], checkpoints: [] };
const opening = {
  attemptMode: 'reserved', puzzleId: ID, rulesetVersion: 'points-v4',
  atBats: pitchers, progressionToken: 'signed-open',
  hintBundle: bundle, attemptProgress: { strikeCount: 0, completedAtBats: [] },
};
const ok = (payload: unknown) => Response.json(payload, { status: 200 });
const error = (code: number, label: string) => Response.json({ error: label }, { status: code });

function setup(responses: Response[]) {
  const request = vi.fn(async (_url: string, _init: RequestInit) => {
    const next = responses.shift();
    if (!next) throw Error('No matching response');
    return next;
  });
  return { client: createCustomNineBrowserTransport(request), request };
}

describe('Custom Nine headless browser transport', () => {
  it('opens a bodyless, same-origin reserved attempt and validates its public state', async () => {
    const { client, request } = setup([ok(opening)]);
    expect(await client.bootstrap(ID)).toEqual(opening);
    expect(request).toHaveBeenCalledWith(
      '/api/custom-nine/challenges/' + ID + '/attempt/bootstrap',
      { method: 'POST', credentials: 'same-origin' },
    );
    expect(JSON.stringify(request.mock.calls)).not.toContain('attemptId');
  });

  it('rehydrates only ordered terminal facts and active hint depth on a later batter', async () => {
    const later = {
      ...opening, progressionToken: 'signed-later',
      hintBundle: { pitchNumber: 2, revealedCount: 1, hints: [hint], checkpoints: [] },
      attemptProgress: { strikeCount: 2, completedAtBats: [fact] },
    };
    const { client } = setup([ok(later)]);
    expect((await client.bootstrap(ID)).attemptMode).toBe('reserved');
  });

  it('keeps creator previews explicitly noncompetitive', async () => {
    const creator = {
      ...opening, attemptMode: 'creator_preview',
      hintBundle: { ...bundle, hints: [hint], checkpoints: [{ revealedCount: 1, progressionToken: 'preview' }] },
    } as Record<string, unknown>;
    delete creator.attemptProgress;
    const { client } = setup([ok(creator)]);
    const actual = await client.bootstrap(ID);
    expect(actual.attemptMode).toBe('creator_preview');
    expect(actual).not.toHaveProperty('attemptProgress');
  });

  it('rejects impossible frozen pitch identities and preauthorized future hints', async () => {
    const impossible = [
      { ...opening, puzzleId: 'different' },
      { ...opening, hintBundle: { ...bundle, hints: [hint] } },
      { ...opening, hintBundle: { ...bundle, checkpoints: [{ revealedCount: 1, progressionToken: 'free' }] } },
      { ...opening, attemptProgress: { strikeCount: 0, completedAtBats: [fact] } },
      { ...opening, atBats: pitchers.map((p, i) => ({ ...p, pitchNumber: i + 2 })) },
      { ...opening, attemptProgress: { strikeCount: 0, completedAtBats: [{ ...fact, initials: 'ZZ' }] } },
    ];
    for (const payload of impossible) {
      const { client } = setup([ok(payload)]);
      await expect(client.bootstrap(ID)).rejects.toMatchObject({ kind: 'invalid_response' });
    }
  });

  it('sends only current signed token when requesting a single server-scored hint', async () => {
    const { client, request } = setup([ok({
      hint: { hintType: hint.hintType, hintLabel: hint.hintLabel, hintValue: hint.hintValue },
      progressionToken: 'signed-next', revision: 1,
    })]);
    expect(await client.revealHint(ID, 'signed-current')).toEqual({
      hint: { hintType: hint.hintType, hintLabel: hint.hintLabel, hintValue: hint.hintValue },
      progressionToken: 'signed-next', revision: 1,
    });
    const args = request.mock.calls[0]!;
    expect(args[0]).toContain('/attempt/hint');
    expect(JSON.parse(args[1].body as string)).toEqual({ progressionToken: 'signed-current' });
    expect(args[1]).toMatchObject({
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    });
  });

  it('decodes incorrect guesses and terminal results without inventing local scores', async () => {
    const { client, request } = setup([
      ok({ kind: 'incorrect', strikeCount: 1, progressionToken: 'signed-1', revision: 1 }),
      ok({ kind: 'terminal', result: {
        kind: 'correct', revealedCount: 0, outcome: 'HR', source: 'initials',
      }, reveal, progressionToken: 'signed-next', hintBundle: {
        pitchNumber: 2, revealedCount: 0, hints: [], checkpoints: [],
      }, revision: 2 }),
    ]);
    expect(await client.resolve(ID, 'signed-0', { submittedPlayerId: 'ibp_123' })).toEqual({
      kind: 'incorrect', strikeCount: 1, progressionToken: 'signed-1', revision: 1,
    });
    const terminal = await client.resolve(ID, 'signed-1', { giveUp: true });
    expect(terminal.kind).toBe('terminal');
    expect(JSON.parse(request.mock.calls[0]![1].body as string)).toEqual({
      progressionToken: 'signed-0', submittedPlayerId: 'ibp_123',
    });
    expect(JSON.parse(request.mock.calls[1]![1].body as string)).toEqual({
      progressionToken: 'signed-1', giveUp: true,
    });
  });

  it('rejects out-of-order previously authorized hints and next-batter future hints', async () => {
    for (const payload of [
      { ...opening, hintBundle: {
        pitchNumber: 1, revealedCount: 1, hints: [{ ...hint, slot: 4 }], checkpoints: [],
      } },
      { ...opening, hintBundle: {
        pitchNumber: 1, revealedCount: 2, hints: [{ ...hint, slot: 1 }, { ...hint, slot: 4 }], checkpoints: [],
      } },
    ]) {
      const { client } = setup([ok(payload)]);
      await expect(client.bootstrap(ID)).rejects.toMatchObject({ kind: 'invalid_response' });
    }
    for (const hintBundle of [
      { pitchNumber: 2, revealedCount: 1, hints: [hint], checkpoints: [] },
      { pitchNumber: 2, revealedCount: 0, hints: [], checkpoints: [{ revealedCount: 1, progressionToken: 'free' }] },
      { pitchNumber: 1, revealedCount: 0, hints: [], checkpoints: [] },
    ]) {
      const { client } = setup([ok({ kind: 'terminal', progressionToken: 'signed-next',
        result: { kind: 'correct', revealedCount: 0, outcome: 'HR', source: 'initials' },
        reveal, hintBundle, revision: 1 })]);
      await expect(client.resolve(ID, 'signed', { submittedPlayerId: 'ibp_example' }))
        .rejects.toMatchObject({ kind: 'invalid_response' });
    }
  });

  it('projects terminal reveal and result without arbitrary private fields', async () => {
    const { client } = setup([ok({ kind: 'terminal', progressionToken: 'signed-next', revision: 1,
      result: { kind: 'correct', revealedCount: 0, outcome: 'HR', source: 'initials',
        privateSource: 'PRIVATE_VALUE' },
      reveal: { ...reveal, canonicalAnswers: 'PRIVATE_FUTURE_IDS', career: {
        ...reveal.career, leakedField: 'PRIVATE', lines: reveal.career.lines,
      } },
      hintBundle: null,
    })]);
    const value = await client.resolve(ID, 'signed', { submittedPlayerId: 'ibp_example' });
    expect(value.kind).toBe('terminal');
    expect(JSON.stringify(value)).not.toContain('PRIVATE');
    if (value.kind === 'terminal') {
      expect(value.result).toEqual({ kind: 'correct', revealedCount: 0, outcome: 'HR', source: 'initials' });
      expect(value.reveal).toEqual(reveal);
    }
  });

  it('requires exact known server response shapes before displaying progress', async () => {
    for (const invalid of [
      { kind: 'incorrect', strikeCount: 3, progressionToken: 'signed', revision: 1 },
      { kind: 'terminal', result: { kind: 'incorrect' }, reveal, hintBundle: null, progressionToken: 'signed', revision: 1 },
      { kind: 'terminal', result: { kind: 'correct' }, reveal, hintBundle: null, progressionToken: 'signed', revision: 1 },
      { kind: 'terminal', result: { kind: 'correct', revealedCount: 0, outcome: 'HR', source: 'initials' },
        reveal: { displayName: 'Incomplete' }, hintBundle: null, progressionToken: 'signed', revision: 1 },
      { hint: { hintType: 'teams', hintLabel: 'Teams' }, progressionToken: 'signed', revision: 1 },
    ]) {
      const { client } = setup([ok(invalid)]);
      if ('hint' in invalid) {
        await expect(client.revealHint(ID, 'signed')).rejects.toMatchObject({ kind: 'invalid_response' });
      } else {
        await expect(client.resolve(ID, 'signed', { giveUp: true })).rejects.toMatchObject({ kind: 'invalid_response' });
      }
    }
  });

  it('distinguishes completed, stale and unavailable sessions without echoing private errors', async () => {
    const { client } = setup([
      error(409, 'attempt_completed'), error(409, 'conflict'),
      error(403, 'invalid_credential'), error(503, 'DATABASE_PRIVATE_SECRET'),
    ]);
    await expect(client.bootstrap(ID)).rejects.toMatchObject({ kind: 'completed' });
    await expect(client.bootstrap(ID)).rejects.toMatchObject({ kind: 'conflict' });
    await expect(client.bootstrap(ID)).rejects.toMatchObject({ kind: 'invalid_credential' });
    await expect(client.bootstrap(ID)).rejects.toMatchObject({ kind: 'unavailable' });
    const { client: unavailable } = setup([]);
    await expect(unavailable.bootstrap(ID)).rejects.toBeInstanceOf(CustomNineBrowserTransportError);
    await expect(unavailable.bootstrap('')).rejects.toMatchObject({ kind: 'invalid_request' });
  });
});
