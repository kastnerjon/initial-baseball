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
vi.mock('./serverCustomLineupV2AccountCreatorExclusion', () => ({
  inspectCustomLineupV2AccountCreator: vi.fn(),
}));

import { createServerCustomLineupV2AttemptBootstrap } from './serverCustomLineupV2AttemptBootstrap';
import { createServerCustomLineupV2AttemptHintService } from './serverCustomLineupV2AttemptHints';
import { createServerCustomLineupV2IncorrectGuessService } from './serverCustomLineupV2IncorrectGuesses';
import { createServerCustomLineupV2CompletedAdmissionService } from './serverCustomLineupV2CompletedAdmission';
import { inspectCustomLineupV2AccountCreator } from './serverCustomLineupV2AccountCreatorExclusion';
import { handleCustomLineupV2GameplayPost, isCustomLineupV2GameplayTransportEnabled }
  from './serverCustomLineupV2GameplayHttp';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const URL = 'https://example.test/api/custom-lineup/challenges/' + ID + '/attempt/';
const player = 'ibp_' + 'a'.repeat(20);
const opening = {
  puzzleId: ID, rulesetVersion: 'points-v4',
  atBats: [{ pitchNumber: 1, initials: 'BH' }],
  progressionToken: 'signed-open',
  hintBundle: { pitchNumber: 1, revealedCount: 0, hints: [], checkpoints: [] },
};
const cookie = 'opaque=valid';
const bootstrap = vi.fn();
const hint = vi.fn();
const attempt = vi.fn();
const submit = vi.fn();
const actions = ['bootstrap', 'hint', 'resolve', 'submit'] as const;

function send(action: typeof actions[number], options: RequestInit = {}, id=ID, suffix='') {
  return handleCustomLineupV2GameplayPost(
    new Request(URL.replace(ID,id) + action + suffix, {
      method: 'POST',
      ...options,
      headers: { origin: 'https://example.test', cookie,
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(options.headers as Record<string, string> | undefined) },
    }),
    { params: Promise.resolve({ puzzleId: id }) }, action,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED', 'true');
  vi.mocked(inspectCustomLineupV2AccountCreator).mockResolvedValue({ owner: false, finish: r => r });
  bootstrap.mockResolvedValue({
    kind: 'ready', bootstrap: opening, setCookie:
      'opaque=valid; Path=/api/custom-lineup/challenges/' + ID + '; HttpOnly; SameSite=Strict; Secure',
    attemptProgress: { strikeCount: 0, completedAtBats: [] },
  });
  hint.mockResolvedValue({ kind: 'revealed', hint: {
    hintType: 'teams', hintLabel: 'Teams', hintValue: 'Mets',
  }, progressionToken: 'signed-hint', revision: 1 });
  attempt.mockResolvedValue({ kind: 'incorrect', strikeCount: 1,
    progressionToken: 'signed-wrong', revision: 1 });
  submit.mockResolvedValue({ kind: 'admitted', status: 'created',
    submissionId: 'private-uuid', summary: { points: 4 } });
  vi.mocked(createServerCustomLineupV2AttemptBootstrap).mockReturnValue({ bootstrap } as never);
  vi.mocked(createServerCustomLineupV2AttemptHintService).mockReturnValue({ reveal: hint } as never);
  vi.mocked(createServerCustomLineupV2IncorrectGuessService).mockReturnValue({ attempt } as never);
  vi.mocked(createServerCustomLineupV2CompletedAdmissionService).mockReturnValue({ admit: submit } as never);
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('off-by-default Custom v2 gameplay HTTP transport', () => {
  it('is disabled for unset, false, and noncanonical flags, without invoking services', async () => {
    for (const flag of ['', 'false', 'TRUE', ' true']) {
      vi.stubEnv('CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED', flag);
      expect(isCustomLineupV2GameplayTransportEnabled()).toBe(false);
      for (const action of actions) {
        const result = await send(action);
        expect(result.status).toBe(404);
        expect(await result.json()).toEqual({ error: 'not_found' });
        expect(result.headers.get('cache-control')).toBe('private, no-store');
      }
    }
    expect(bootstrap).not.toHaveBeenCalled();
    expect(hint).not.toHaveBeenCalled();
    expect(attempt).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('rejects missing/foreign origin, query and foreign version before any service call', async () => {
    for (const action of actions) {
      expect((await send(action, { headers: { origin: 'https://evil.test' } })).status).toBe(403);
      expect((await send(action, { headers: { origin: '' } })).status).toBe(403);
      expect((await send(action, {}, ID, '?submissionId=chosen')).status).toBe(400);
      expect((await send(action, {}, 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000')).status)
        .toBe(404);
    }
    expect(bootstrap).not.toHaveBeenCalled();
    expect(hint).not.toHaveBeenCalled();
    expect(attempt).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('reserves and restores a first attempt with an HttpOnly cookie and no private IDs', async () => {
    const r = await send('bootstrap');
    expect(r.status).toBe(200);
    expect(r.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Strict; Secure');
    expect(r.headers.get('vary')).toBe('Cookie');
    expect(await r.json()).toEqual({
      ...opening, attemptMode: 'reserved',
      attemptProgress: { strikeCount: 0, completedAtBats: [] },
    });
    expect(bootstrap).toHaveBeenCalledWith(ID, cookie, URL + 'bootstrap', false);
    bootstrap.mockResolvedValueOnce({
      kind: 'ready', bootstrap: { ...opening, progressionToken: 'signed-resumed',
        hintBundle: { pitchNumber: 1, revealedCount: 1,
          hints: [{slot:1,hintType:'main_decade',hintLabel:'Decade',hintValue:'1990s'}],
          checkpoints: [] } },
      setCookie: null, attemptProgress: { strikeCount: 2, completedAtBats: [] },
    });
    const resumed = await send('bootstrap');
    expect(resumed.headers.get('set-cookie')).toBeNull();
    expect(await resumed.json()).toMatchObject({
      attemptMode: 'reserved', attemptProgress: { strikeCount: 2 },
      progressionToken: 'signed-resumed', hintBundle: { revealedCount: 1 },
    });
  });

  it('returns creator preview and completed snapshot without new token or result leakage', async () => {
    bootstrap.mockResolvedValueOnce({ kind: 'preview', bootstrap: opening });
    const preview = await send('bootstrap');
    expect(await preview.json()).toMatchObject({ attemptMode: 'creator_preview' });
    expect(preview.headers.get('set-cookie')).toBeNull();
    bootstrap.mockResolvedValueOnce({
      kind: 'completed', atBats: opening.atBats,
      completedAtBats: [{ pitchNumber: 1, initials: 'BH', outcome: 'HR',
        hintsRevealed: 0, wrongGuesses: 0, resolution: 'correct' }],
      revision: 1, completedAt: '2026-10-15T12:00:00Z',
    });
    const result = await send('bootstrap');
    const json = await result.json() as Record<string, unknown>;
    expect(json.attemptMode).toBe('completed');
    expect(json).not.toHaveProperty('progressionToken');
    expect(json).not.toHaveProperty('hintBundle');
    expect(json).not.toHaveProperty('attemptId');
    expect(result.headers.get('set-cookie')).toBeNull();
  });

  it('shows signed-in creator preview without reserving and blocks mutations/completion', async () => {
    vi.mocked(inspectCustomLineupV2AccountCreator).mockResolvedValue({
      owner: true, finish: r => r,
    });
    bootstrap.mockResolvedValueOnce({ kind: 'preview', bootstrap: opening });
    const result = await send('bootstrap');
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ attemptMode: 'creator_preview' });
    expect(bootstrap).toHaveBeenCalledWith(ID, cookie, URL + 'bootstrap', true);
    for (const action of ['submit', 'hint', 'resolve'] as const) {
      const blocked = await send(action);
      expect(blocked.status).toBe(403);
      expect(await blocked.json()).toEqual({ error: 'invalid_credential' });
    }
    expect(submit).not.toHaveBeenCalled();
    expect(hint).not.toHaveBeenCalled();
    expect(attempt).not.toHaveBeenCalled();
  });

  it('applies refreshed auth cookies after gameplay without losing an attempt cookie', async () => {
    vi.mocked(inspectCustomLineupV2AccountCreator).mockResolvedValueOnce({
      owner: false,
      finish: result => {
        result.headers.append('set-cookie', 'sb-refresh=token; Path=/; HttpOnly');
        return result;
      },
    });
    const res = await send('bootstrap');
    const cookies = res.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('sb-refresh=token');
    expect(cookies).toContain('opaque=valid; Path=');
  });

  it('rejects nonempty bootstrap or submit bodies, including streaming body', async () => {
    expect((await send('bootstrap', { body: '{}' })).status).toBe(400);
    expect((await send('submit', { body: '{"score":100}' })).status).toBe(400);
    const body = new ReadableStream<Uint8Array>({ start(c) {
      c.enqueue(new TextEncoder().encode('x')); c.close();
    } });
    expect((await send('bootstrap', {body,duplex:'half'} as unknown as RequestInit)).status).toBe(400);
    expect(bootstrap).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('sends one signed hint, without accepting extra body fields', async () => {
    const request = { headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ progressionToken: 'signed-open' }) };
    const r = await send('hint', request);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      hint: {hintType:'teams',hintLabel:'Teams',hintValue:'Mets'},
      progressionToken:'signed-hint',revision:1,
    });
    expect(hint).toHaveBeenCalledWith(ID,cookie,'signed-open');
    expect((await send('hint', { body: JSON.stringify({progressionToken:'s',extra:'private'}) })).status)
      .toBe(400);
    expect((await send('hint', { body: 'invalid-json' })).status).toBe(400);
    expect(hint).toHaveBeenCalledTimes(1);
  });

  it('requires application/json for signed hint and resolve mutations before service dispatch', async () => {
    for (const action of ['hint', 'resolve'] as const) {
      const body = action === 'hint' ? { progressionToken: 'signed-open' }
        : { progressionToken: 'signed-open', submittedPlayerId: player };
      for (const type of ['text/plain', 'application/x-www-form-urlencoded',
        'application/merge-patch+json', '']) {
        const result = await send(action, {
          headers: { 'content-type': type }, body: JSON.stringify(body),
        });
        expect(result.status).toBe(400);
        expect(await result.json()).toEqual({ error: 'invalid_request' });
      }
      const result = await send(action, {
        headers: { 'content-type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(body),
      });
      expect(result.status).toBe(200);
    }
    expect(hint).toHaveBeenCalledTimes(1);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('dispatches all wrong and terminal guesses through the SAME atomic v2 service', async () => {
    const body={progressionToken:'signed-current',submittedPlayerId:player};
    const wrong=await send('resolve', {body:JSON.stringify(body)});
    expect(await wrong.json()).toEqual({kind:'incorrect',strikeCount:1,
      progressionToken:'signed-wrong',revision:1});
    expect(attempt).toHaveBeenCalledWith(ID,cookie,body);
    attempt.mockResolvedValueOnce({
      kind:'terminal',result:{kind:'correct',revealedCount:0,outcome:'HR',source:'initials'},
      reveal:{
        playerId:player,displayName:'Correct Player',playerType:'hitter',
        primaryPosition:'RF',yearsPlayedDisplay:'1990–2000',
        teamIds:[],career:{lines:[{kind:'hitter',stats:{HR:10}}]},seasons:[],
        secret:'PRIVATE_ANSWER',
      },
      progressionToken:'signed-next',revision:2,completed:false,
      hintBundle:{pitchNumber:2,revealedCount:0,hints:[],checkpoints:[]},
    });
    const terminal=await send('resolve', {body:JSON.stringify({progressionToken:'signed-wrong',giveUp:true})});
    const json=await terminal.json() as { kind: string; reveal: { displayName: string } };
    expect(json.kind).toBe('terminal');
    expect(json.reveal.displayName).toBe('Correct Player');
    expect(JSON.stringify(json)).not.toContain('PRIVATE_ANSWER');
    expect(attempt).toHaveBeenCalledTimes(2);
    expect((await send('resolve',{body:JSON.stringify({progressionToken:'signed',submittedPlayerId:'A R'})})).status).toBe(400);
    expect((await send('resolve',{body:JSON.stringify({progressionToken:'signed',giveUp:false})})).status).toBe(400);
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('submits only the bodyless completed ledger, with no submission ID or summary', async () => {
    const result=await send('submit');
    expect(result.status).toBe(201);
    expect(await result.json()).toEqual({status:'created'});
    expect(submit).toHaveBeenCalledWith(ID,cookie);
    submit.mockResolvedValueOnce({kind:'admitted',status:'existing',submissionId:'private-uuid'});
    const retry=await send('submit');
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({status:'existing'});
  });

  it('logs only safe action/status diagnostics on unexpected provider failures', async () => {
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      for (const action of actions) {
        const failing = action === 'bootstrap' ? bootstrap
          : action === 'hint' ? hint : action === 'resolve' ? attempt : submit;
        failing.mockRejectedValueOnce(new Error('PRIVATE_COOKIE_TOKEN_OWNER_ANSWER_STACK'));
        const options = action === 'hint' ? {
          body: JSON.stringify({ progressionToken: 'signed-secret' }),
        } : action === 'resolve' ? {
          body: JSON.stringify({ progressionToken: 'signed-secret', submittedPlayerId: player }),
        } : {};
        const result = await send(action, options);
        expect(result.status).toBe(503);
        expect(result.headers.get('set-cookie')).toBeNull();
        expect(await result.json()).toEqual({ error: 'session_unavailable' });
        expect(diagnostic).toHaveBeenCalledTimes(1);
        const payload = String(diagnostic.mock.calls[0]?.[0]);
        expect(JSON.parse(payload)).toEqual({
          event: 'custom_lineup_gameplay_unavailable', action, status: 503,
        });
        expect(payload).not.toContain('PRIVATE_COOKIE_TOKEN_OWNER_ANSWER_STACK');
        expect(payload).not.toContain('signed-secret');
        expect(payload).not.toContain(player);
        diagnostic.mockClear();
      }
      expect((await send('hint', { body: 'invalid-json' })).status).toBe(400);
      expect(diagnostic).not.toHaveBeenCalled();
    } finally {
      diagnostic.mockRestore();
    }
  });

  it('uses consistent sanitized errors and never sets an accidental cookie', async () => {
    for (const [kind,status] of [['not_found',404],['invalid_credential',403],
      ['invalid_progression',400],['conflict',409],['completed',409]] as const) {
      attempt.mockResolvedValueOnce({kind});
      const res=await send('resolve',{body:JSON.stringify({progressionToken:'s',submittedPlayerId:player})});
      expect(res.status).toBe(status);
      expect(res.headers.get('set-cookie')).toBeNull();
      expect(await res.json()).toEqual({error:kind});
    }
    submit.mockResolvedValueOnce({kind:'incomplete'});
    expect((await send('submit')).status).toBe(409);
    attempt.mockRejectedValueOnce(new Error('PRIVATE_DATABASE_AND_SECRET'));
    const failure=await send('resolve',{body:JSON.stringify({progressionToken:'s',submittedPlayerId:player})});
    expect(failure.status).toBe(503);
    expect(await failure.text()).toBe('{"error":"session_unavailable"}');
  });
});
