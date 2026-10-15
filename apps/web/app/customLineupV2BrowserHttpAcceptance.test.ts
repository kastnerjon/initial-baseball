import { getDailyAtBatPoints } from '@initial-baseball/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./serverCustomLineupV2AttemptBootstrap', () => ({
  createServerCustomLineupV2AttemptBootstrap: vi.fn(),
}));
vi.mock('./serverCustomLineupV2AttemptHints', () => ({
  createServerCustomLineupV2AttemptHintService: vi.fn(),
}));
vi.mock('./serverCustomLineupV2IncorrectGuesses', () => ({
  createServerCustomLineupV2IncorrectGuessService: vi.fn(),
}));
vi.mock('./serverCustomLineupV2CompletedAdmission', () => ({
  createServerCustomLineupV2CompletedAdmissionService: vi.fn(),
}));

import { createServerCustomLineupV2AttemptBootstrap } from './serverCustomLineupV2AttemptBootstrap';
import { createServerCustomLineupV2AttemptHintService } from './serverCustomLineupV2AttemptHints';
import { createServerCustomLineupV2IncorrectGuessService } from './serverCustomLineupV2IncorrectGuesses';
import { createServerCustomLineupV2CompletedAdmissionService } from './serverCustomLineupV2CompletedAdmission';
import { createCustomLineupV2BrowserTransport } from './customLineupV2BrowserTransport';
import { handleCustomLineupV2GameplayPost } from './serverCustomLineupV2GameplayHttp';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const RIGHT = 'ibp_' + 'a'.repeat(20);
const WRONG = 'ibp_' + 'b'.repeat(20);
const HINT = { hintType: 'main_decade', hintLabel: 'Main decade', hintValue: '1980s' };
const REVEAL = {
  playerId: RIGHT, displayName: 'Resolved Player', playerType: 'hitter',
  primaryPosition: 'RF', yearsPlayedDisplay: '1980–2000', teamIds: ['NYM'],
  career: { lines: [{ kind: 'hitter', stats: { HR: 50 } }] }, seasons: [],
};
const ACTIONS = ['bootstrap', 'hint', 'resolve', 'submit'] as const;
type Fact = {
  pitchNumber: number; initials: string; outcome: string; hintsRevealed: number;
  wrongGuesses: number; resolution: 'correct' | 'strikeout';
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED', 'true');
});
afterEach(() => vi.unstubAllEnvs());

/** Actual browser DTO + actual Next HTTP handler, with controlled private services.
 * This is contract integration, not a hosted-DB or physical-browser E2E claim. */
function controlledSession(n: number, creator = false) {
  const atBats = Array.from({ length: n }, (_, i) => ({
    pitchNumber: i + 1, initials: 'P' + (i + 1),
  }));
  let revision = 0;
  let strikes = 0;
  let hintDepth = 0;
  let admitted = false;
  const facts: Fact[] = [];
  const token = () => 'signed-' + revision;
  const activeBundle = () => ({
    pitchNumber: facts.length + 1, revealedCount: hintDepth,
    hints: hintDepth ? [{ slot: 1, ...HINT }] : [], checkpoints: [],
  });
  const open = () => ({
    puzzleId: ID, rulesetVersion: 'points-v4', atBats,
    progressionToken: token(), hintBundle: activeBundle(),
  });
  const bootstrap = vi.fn(async (_id: string, cookie: string | null) => {
    if (creator) {
      return { kind: 'preview', bootstrap: open() };
    }
    if (facts.length === n) {
      return { kind: 'completed', atBats, completedAtBats: facts,
        revision, completedAt: '2026-10-15T18:00:00.000Z' };
    }
    return {
      kind: 'ready', bootstrap: open(), attemptProgress: {
        strikeCount: strikes, completedAtBats: [...facts],
      },
      setCookie: cookie ? null :
        'ib-v2-test=valid; Path=/api/custom-lineup/challenges/' + ID +
        '; HttpOnly; SameSite=Strict; Secure',
    };
  });
  const reveal = vi.fn(async (_id: string, _cookie: string | null, received: string) => {
    if (creator) return { kind: 'invalid_credential' };
    if (received !== token() || hintDepth > 0) return { kind: 'conflict' };
    hintDepth = 1;
    revision++;
    return { kind: 'revealed', hint: HINT, progressionToken: token(), revision };
  });
  const attempt = vi.fn(async (_id: string, _cookie: string | null,
    guess: { progressionToken: string; submittedPlayerId?: string; giveUp?: true }) => {
    if (creator) return { kind: 'invalid_credential' };
    if (guess.progressionToken !== token()) return { kind: 'conflict' };
    const correct = guess.submittedPlayerId === RIGHT;
    if (!correct) strikes++;
    revision++;
    if (!correct && strikes < 3 && guess.giveUp !== true) {
      return { kind: 'incorrect', strikeCount: strikes, revision,
        progressionToken: token() };
    }
    const strikeout = !correct;
    const outcome = strikeout ? 'K' : hintDepth ? '3B' : 'HR';
    const result = strikeout
      ? { kind: 'strikeout', revealedCount: hintDepth, outcome: 'K',
          strikeCount: 3, source: 'strikeout' }
      : { kind: 'correct', revealedCount: hintDepth, outcome,
          source: hintDepth ? 1 : 'initials' };
    facts.push({
      pitchNumber: facts.length + 1, initials: atBats[facts.length]!.initials,
      outcome, hintsRevealed: hintDepth, wrongGuesses: strikeout ? 3 : strikes,
      resolution: strikeout ? 'strikeout' : 'correct',
    });
    strikes = 0;
    hintDepth = 0;
    return {
      kind: 'terminal', result, reveal: REVEAL, revision,
      progressionToken: token(), completed: facts.length === n,
      hintBundle: facts.length === n ? null : activeBundle(),
    };
  });
  const submit = vi.fn(async () => {
    if (creator) return { kind: 'invalid_credential' };
    if (facts.length !== n) return { kind: 'incomplete' };
    const status = admitted ? 'existing' : 'created';
    admitted = true;
    return { kind: 'admitted', status, submissionId: 'PRIVATE_ATTEMPT_UUID' };
  });
  vi.mocked(createServerCustomLineupV2AttemptBootstrap)
    .mockReturnValue({ bootstrap } as never);
  vi.mocked(createServerCustomLineupV2AttemptHintService)
    .mockReturnValue({ reveal } as never);
  vi.mocked(createServerCustomLineupV2IncorrectGuessService)
    .mockReturnValue({ attempt } as never);
  vi.mocked(createServerCustomLineupV2CompletedAdmissionService)
    .mockReturnValue({ admit: submit } as never);

  let cookie = creator ? 'creator=valid' : '';
  const network = vi.fn(async (path: string, init: RequestInit) => {
    const action = ACTIONS.find(name => path.endsWith('/' + name));
    if (!action) throw new Error('Unexpected browser route');
    const headers = new Headers(init.headers);
    headers.set('origin', 'https://example.test');
    if (cookie) headers.set('cookie', cookie);
    const request = new Request('https://example.test' + path, {
      method: init.method, headers, body: init.body,
    });
    const reply = await handleCustomLineupV2GameplayPost(
      request, { params: Promise.resolve({ puzzleId: ID }) }, action,
    );
    const setCookie = reply.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0]!;
    return reply;
  });
  return {
    client: createCustomLineupV2BrowserTransport(network),
    network, bootstrap, reveal, attempt, submit, facts,
  };
}

describe('Custom Lineup v2 browser-to-HTTP contract acceptance', () => {
  it.each([1, 5, 9, 10])('restores and completes exact N=%i with no answer leaks or duplicate admission', async n => {
    const s = controlledSession(n);
    const opening = await s.client.bootstrap(ID);
    expect(opening.attemptMode).toBe('reserved');
    if (opening.attemptMode !== 'reserved') throw Error('Expected reserved session');
    expect(opening.atBats).toHaveLength(n);
    expect(JSON.stringify(opening)).not.toContain(RIGHT);
    await expect(s.client.submit(ID)).rejects.toMatchObject({ kind: 'conflict' });

    const firstHint = await s.client.revealHint(ID, opening.progressionToken);
    const hinted = await s.client.bootstrap(ID);
    if (hinted.attemptMode !== 'reserved') throw Error('Expected restored session');
    expect(hinted.hintBundle.hints).toHaveLength(1);
    expect(hinted.hintBundle.hints[0]?.hintValue).toBe('1980s');
    expect(hinted.attemptProgress.strikeCount).toBe(0);
    const wrong = await s.client.resolve(ID, firstHint.progressionToken, 1, n,
      { submittedPlayerId: WRONG });
    expect(wrong).toMatchObject({ kind: 'incorrect', strikeCount: 1 });
    if (wrong.kind !== 'incorrect') throw Error('Expected incorrect guess');
    const resumed = await s.client.bootstrap(ID);
    if (resumed.attemptMode !== 'reserved') throw Error('Expected saved first attempt');
    expect(resumed.attemptProgress.strikeCount).toBe(1);
    expect(resumed.hintBundle.revealedCount).toBe(1);

    let signed = wrong.progressionToken;
    for (let pitch = 1; pitch <= n; pitch++) {
      const committed = await s.client.resolve(ID, signed, pitch, n,
        { submittedPlayerId: RIGHT });
      expect(committed.kind).toBe('terminal');
      if (committed.kind !== 'terminal') throw Error('Expected terminal fact');
      expect(committed.completed).toBe(pitch === n);
      expect(committed.hintBundle?.pitchNumber ?? null)
        .toBe(pitch === n ? null : pitch + 1);
      expect(committed.reveal.displayName).toBe('Resolved Player');
      signed = committed.progressionToken;
    }

    const saved = await s.client.bootstrap(ID);
    expect(saved.attemptMode).toBe('completed');
    if (saved.attemptMode !== 'completed') throw Error('Expected completed ledger');
    expect(saved.completedAtBats).toHaveLength(n);
    expect(saved.completedAtBats[0]?.outcome).toBe('3B');
    expect(saved.completedAtBats.slice(1).every(f => f.outcome === 'HR')).toBe(true);
    const points = saved.completedAtBats.reduce((sum, fact) =>
      sum + getDailyAtBatPoints({ ...fact, rulesetVersion: 'points-v4' }), 0);
    expect(points).toBe(4 * n - 1);
    expect(4 * n).toBeGreaterThanOrEqual(points);
    expect(JSON.stringify(saved)).not.toContain('PRIVATE_ATTEMPT_UUID');
    expect(JSON.stringify(saved)).not.toContain('progressionToken');
    expect(await s.client.submit(ID)).toBe('created');
    expect(await s.client.submit(ID)).toBe('existing');
    expect(s.submit).toHaveBeenCalledTimes(3);
    expect(s.network.mock.calls.every(call => !String(call[1].body ?? '').includes('score')))
      .toBe(true);
  });

  it('keeps creating browsers noncompetitive across all four HTTP actions', async () => {
    const s = controlledSession(5, true);
    const state = await s.client.bootstrap(ID);
    expect(state.attemptMode).toBe('creator_preview');
    if (state.attemptMode !== 'creator_preview') throw Error('Expected preview');
    expect(state).not.toHaveProperty('attemptProgress');
    await expect(s.client.revealHint(ID, state.progressionToken))
      .rejects.toMatchObject({ kind: 'invalid_credential' });
    await expect(s.client.resolve(ID, state.progressionToken, 1, 5,
      { submittedPlayerId: RIGHT })).rejects.toMatchObject({ kind: 'invalid_credential' });
    await expect(s.client.submit(ID)).rejects.toMatchObject({ kind: 'invalid_credential' });
    expect(s.facts).toHaveLength(0);
  });

  it('404s at the actual route before calling any private service when disabled', async () => {
    const s = controlledSession(1);
    vi.stubEnv('CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED', 'false');
    await expect(s.client.bootstrap(ID)).rejects.toMatchObject({ kind: 'not_found' });
    expect(s.bootstrap).not.toHaveBeenCalled();
    expect(s.reveal).not.toHaveBeenCalled();
    expect(s.attempt).not.toHaveBeenCalled();
    expect(s.submit).not.toHaveBeenCalled();
  });

  it('preserves atomic third-strike terminal semantics and removes live tokens at completion', async () => {
    const s = controlledSession(1);
    const opening = await s.client.bootstrap(ID);
    if (opening.attemptMode !== 'reserved') throw Error('Expected reserved');
    let signed = opening.progressionToken;
    for (let strike = 1; strike <= 3; strike++) {
      const result = await s.client.resolve(ID, signed, 1, 1,
        { submittedPlayerId: WRONG });
      signed = result.progressionToken;
      if (strike < 3) expect(result).toMatchObject({kind:'incorrect',strikeCount:strike});
      else expect(result).toMatchObject({kind:'terminal',completed:true,
        result:{kind:'strikeout',outcome:'K',strikeCount:3}});
    }
    expect(s.facts).toHaveLength(1);
    const saved = await s.client.bootstrap(ID);
    expect(saved.attemptMode).toBe('completed');
    if (saved.attemptMode !== 'completed') throw Error('Expected completed');
    expect(saved.completedAtBats[0]?.outcome).toBe('K');
  });
});
