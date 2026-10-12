import { describe, expect, it, vi } from 'vitest';
import type { CustomNineBootstrapResponse } from './serverCustomNineBootstrap';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';
import type { DailyProgressionClaims } from './dailyProgressionToken';
import { createCustomNineProgressionTokens, CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';

vi.mock('server-only', () => ({}));

import { createCustomNineCreatorBrowserMarker } from './customNineCreatorBrowser';
import { createServerCustomNineAttemptBootstrap } from './serverCustomNineAttemptBootstrap';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001';
const SECRET = 'test-progression-key-long-enough-for-custom-attempt-issuance';
const URL = 'https://example.test/api/custom-nine/challenges/' + ID + '/attempt/bootstrap';
const codec = createCustomNineProgressionTokens(SECRET);
const signed = (overrides: Partial<DailyProgressionClaims> = {}) => codec.sign({
  version: 1, rulesetVersion: 'points-v4',
  puzzleId: ID, puzzleDate: CUSTOM_NINE_SESSION_DATE,
  pitchNumber: 1, revealCount: 0, strikeCount: 0, outCount: 0,
  completed: false, ...overrides,
});
const OPEN = signed();
const LATER = signed({ pitchNumber: 2 });
const WRONG = signed({ strikeCount: 2 });
const FIRST_FACT = {
  pitchNumber: 1, initials: 'P1', outcome: 'HR', hintsRevealed: 0,
  wrongGuesses: 0, resolution: 'correct',
} as const;
const stored = (
  digest: string, token = OPEN, status: 'active' | 'completed' = 'active',
  facts: CustomNineAttemptState['terminalAtBats'] = [],
): CustomNineAttemptState => ({
  challengeId: ID, browserKeyDigest: digest,
  attemptId: '123e4567-e89b-42d3-a456-426614174010',
  revision: token === OPEN ? 0 : token === WRONG ? 2 : 1,
  currentProgressionToken: token, terminalAtBats: facts,
  status, createdAt: '2026-10-10T16:00:00Z',
  updatedAt: '2026-10-10T16:00:00Z', completedAt: status === 'completed' ? '2026-10-10T17:00:00Z' : null,
});
const BASE = {
  puzzleId: ID, rulesetVersion: 'points-v4', progressionToken: OPEN,
  atBats: Array.from({ length: 9 }, (_, index) => ({ pitchNumber: index + 1, initials: 'P' + (index + 1) })),
  hintBundle: { pitchNumber: 1, revealedCount: 0, hints: [], checkpoints: [] },
} as unknown as CustomNineBootstrapResponse;

function setup() {
  const byKey = new Map<string, CustomNineAttemptState>();
  const repo = {
    getByKey: vi.fn(async (key: { browserKeyDigest: string }) => byKey.get(key.browserKeyDigest) ?? null),
    getOrCreate: vi.fn(async (key: { browserKeyDigest: string }, initialToken: string) => {
      const value = stored(key.browserKeyDigest, initialToken);
      const old = byKey.get(key.browserKeyDigest);
      if (!old) byKey.set(key.browserKeyDigest, value);
      return { status: (old ? 'existing' : 'inserted') as 'existing' | 'inserted', state: old ?? value };
    }),
  };
  const deps = {
    bootstrap: vi.fn(async (_id: string): Promise<CustomNineBootstrapResponse | null> => BASE),
    restore: vi.fn(async (_id: string, token: string) => ({
      hintBundle: { ...BASE.hintBundle, pitchNumber: token === LATER ? 2 : 1 },
    })),
    attemptRepository: vi.fn(() => repo),
    getSecret: vi.fn(() => SECRET),
  };
  const service = createServerCustomNineAttemptBootstrap({ dependencies: deps });
  return { repo, deps, service, byKey };
}

describe('staged Custom Nine challenge-specific attempt bootstrap', () => {
  it('issues one signed HttpOnly cookie only after durable first reservation', async () => {
    const { service, repo, deps } = setup();
    const result = await service.bootstrap(ID, null, URL);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') throw Error('Expected reserved attempt.');
    expect(result.bootstrap).toEqual(BASE);
    expect(result.attemptProgress).toEqual({ strikeCount: 0, completedAtBats: [] });
    expect(result.setCookie).toContain('; HttpOnly; SameSite=Strict; Secure');
    expect(result.setCookie).not.toContain('Domain=');
    expect(result.setCookie).not.toContain('attempt_id');
    expect(repo.getOrCreate).toHaveBeenCalledOnce();
    expect(repo.getByKey).not.toHaveBeenCalled();
    expect(deps.restore).not.toHaveBeenCalled();
  });

  it('hides unrevealed hint values and pre-signed checkpoints on the reserved attempt path', async () => {
    const { service, deps } = setup();
    const hintBundle = {
      pitchNumber: 1, revealedCount: 0 as const,
      hints: [
        { slot: 1, hintType: 'teams', hintLabel: 'Teams', hintValue: 'FIRST_PRIVATE_HINT' },
        { slot: 2, hintType: 'position', hintLabel: 'Position', hintValue: 'SECOND_PRIVATE_HINT' },
      ],
      checkpoints: [{ revealedCount: 1, progressionToken: 'pre-signed-first-reveal' }],
    } as unknown as CustomNineBootstrapResponse['hintBundle'];
    deps.bootstrap.mockResolvedValueOnce({ ...BASE, hintBundle });
    const reserved = await service.bootstrap(ID, null, URL);
    expect(reserved.kind).toBe('ready');
    if (reserved.kind !== 'ready') throw Error('Missing reserved session');
    expect(reserved.bootstrap.hintBundle).toMatchObject({
      revealedCount: 0, hints: [], checkpoints: [],
    });
    expect(JSON.stringify(reserved)).not.toContain('PRIVATE_HINT');
    expect(JSON.stringify(reserved)).not.toContain('pre-signed-first-reveal');
  });

  it('resumes existing challenge state with the original token, no new cookie or insert', async () => {
    const { service, repo, byKey, deps } = setup();
    const first = await service.bootstrap(ID, null, URL);
    if (first.kind !== 'ready' || first.setCookie === null) throw Error('Missing issued cookie');
    const pair = first.setCookie.split(';')[0]!;
    const digest = [...byKey.keys()][0]!;
    byKey.set(digest, stored(digest, LATER, 'active', [FIRST_FACT]));
    const resumed = await service.bootstrap(ID, pair, URL);
    expect(resumed).toMatchObject({
      kind: 'ready', setCookie: null, bootstrap: {
        progressionToken: LATER, hintBundle: { pitchNumber: 2 },
      },
    });
    expect(resumed.kind).toBe('ready');
    if (resumed.kind !== 'ready') throw Error('Expected resumed attempt.');
    expect(resumed.attemptProgress).toEqual({ strikeCount: 0, completedAtBats: [FIRST_FACT] });
    expect(repo.getOrCreate).toHaveBeenCalledTimes(1);
    expect(repo.getByKey).toHaveBeenCalledOnce();
    expect(deps.restore).toHaveBeenCalledWith(ID, LATER);
    const replay = await service.bootstrap(ID, pair, URL);
    expect(replay.kind).toBe('ready');
    expect(repo.getOrCreate).toHaveBeenCalledTimes(1);
  });

  it('restores current signed wrong-guess strikes, never user-local state', async () => {
    const { service, byKey } = setup();
    const first = await service.bootstrap(ID, null, URL);
    if (first.kind !== 'ready' || !first.setCookie) throw Error('Expected cookie');
    const key = [...byKey.keys()][0]!;
    byKey.set(key, stored(key, WRONG));
    const resumed = await service.bootstrap(ID, first.setCookie.split(';')[0]!, URL);
    expect(resumed.kind).toBe('ready');
    if (resumed.kind !== 'ready') throw Error('Expected resumed state');
    expect(resumed.attemptProgress).toEqual({ strikeCount: 2, completedAtBats: [] });
    expect(resumed.bootstrap.hintBundle.pitchNumber).toBe(1);
  });

  it('fails closed for signed tokens from another challenge, incorrect pitch or invalid saved initials', async () => {
    const { service, byKey } = setup();
    const first = await service.bootstrap(ID, null, URL);
    if (first.kind !== 'ready' || !first.setCookie) throw Error('Expected cookie');
    const pair = first.setCookie.split(';')[0]!;
    const key = [...byKey.keys()][0]!;
    for (const token of [
      signed({ puzzleId: OTHER }),
      LATER,
      signed({ pitchNumber: 2, outCount: 1 }),
      signed({ completed: true }),
    ]) {
      byKey.set(key, stored(key, token));
      await expect(service.bootstrap(ID, pair, URL)).rejects.toThrow();
    }
    byKey.set(key, stored(key, LATER, 'active', [{ ...FIRST_FACT, initials: 'ZZ' }]));
    await expect(service.bootstrap(ID, pair, URL)).rejects.toThrow('terminal facts mismatch');
    byKey.set(key, stored(key, LATER, 'active', [FIRST_FACT]));
    const resumed = await service.bootstrap(ID, pair, URL);
    expect(resumed.kind).toBe('ready');
  });

  it('rejects corrupt saved action revisions even when token and terminal facts appear valid', async () => {
    const { service, byKey } = setup();
    const first = await service.bootstrap(ID, null, URL);
    if (first.kind !== 'ready' || !first.setCookie) throw Error('Expected cookie');
    const key = [...byKey.keys()][0]!;
    const cookie = first.setCookie.split(';')[0]!;
    for (const revision of [0, 4]) {
      byKey.set(key, { ...stored(key, LATER, 'active', [FIRST_FACT]), revision });
      await expect(service.bootstrap(ID, cookie, URL)).rejects.toThrow('revision mismatch');
    }
    byKey.set(key, { ...stored(key, WRONG), revision: 1 });
    await expect(service.bootstrap(ID, cookie, URL)).rejects.toThrow('revision mismatch');
    byKey.set(key, stored(key, LATER, 'active', [FIRST_FACT]));
    expect((await service.bootstrap(ID, cookie, URL)).kind).toBe('ready');
  });

  it('counts prior hints and nonterminal incorrect guesses when reconstructing revision', async () => {
    const { service, byKey } = setup();
    const first = await service.bootstrap(ID, null, URL);
    if (first.kind !== 'ready' || !first.setCookie) throw Error('Expected cookie');
    const key = [...byKey.keys()][0]!;
    const cookie = first.setCookie.split(';')[0]!;
    const terminal = { ...FIRST_FACT, outcome: '2B' as const, hintsRevealed: 2 as const, wrongGuesses: 1 };
    byKey.set(key, { ...stored(key, LATER, 'active', [terminal]), revision: 4 });
    const resumed = await service.bootstrap(ID, cookie, URL);
    expect(resumed.kind).toBe('ready');
    byKey.set(key, { ...stored(key, LATER, 'active', [terminal]), revision: 5 });
    await expect(service.bootstrap(ID, cookie, URL)).rejects.toThrow('revision mismatch');
  });

  it('lets verified creating browsers preview without reserving a contributing attempt', async () => {
    const { service, repo, deps } = setup();
    const creator = createCustomNineCreatorBrowserMarker(SECRET)
      .creatorCookie(ID, URL).split(';')[0]!;
    const result = await service.bootstrap(ID, creator, URL);
    expect(result).toEqual({ kind: 'preview', bootstrap: BASE });
    expect(repo.getOrCreate).not.toHaveBeenCalled();
    expect(repo.getByKey).not.toHaveBeenCalled();
    expect(deps.attemptRepository).not.toHaveBeenCalled();
  });

  it('rejects bad creator and attempt cookies, including duplicate cookies, before any private reads', async () => {
    const { service, deps, repo } = setup();
    const creatorName = createCustomNineCreatorBrowserMarker(SECRET)
      .creatorCookie(ID, URL).split(';')[0]!.split('=')[0]!;
    const first = await service.bootstrap(ID, creatorName + '=forged', URL);
    expect(first.kind).toBe('invalid_credential');
    const minted = await service.bootstrap(ID, null, URL);
    if (minted.kind !== 'ready' || minted.setCookie === null) throw Error('Expected cookie');
    const pair = minted.setCookie.split(';')[0]!;
    const before = deps.bootstrap.mock.calls.length;
    for (const cookie of [pair + '; ' + pair, pair.replace(/.$/, '!')]) {
      expect(await service.bootstrap(ID, cookie, URL)).toEqual({ kind: 'invalid_credential' });
    }
    expect(deps.bootstrap.mock.calls.length).toBe(before);
    expect(repo.getOrCreate).toHaveBeenCalledOnce();
  });

  it('never replaces lost attempt state for a still-valid cookie, or restarts a completed game', async () => {
    const { service, byKey, repo } = setup();
    const created = await service.bootstrap(ID, null, URL);
    if (created.kind !== 'ready' || created.setCookie === null) throw Error('Expected cookie');
    const pair = created.setCookie.split(';')[0]!;
    const digest = [...byKey.keys()][0]!;
    byKey.delete(digest);
    expect(await service.bootstrap(ID, pair, URL)).toEqual({ kind: 'invalid_credential' });
    byKey.set(digest, stored(digest, OPEN, 'completed'));
    expect(await service.bootstrap(ID, pair, URL)).toEqual({ kind: 'completed' });
    expect(repo.getOrCreate).toHaveBeenCalledOnce();
  });

  it('rejects invalid or missing challenge IDs without creating attempts', async () => {
    const { service, deps, repo } = setup();
    expect(await service.bootstrap('bad', null, URL)).toEqual({ kind: 'not_found' });
    expect(deps.getSecret).not.toHaveBeenCalled();
    expect(repo.getOrCreate).not.toHaveBeenCalled();
    deps.bootstrap.mockResolvedValueOnce(null);
    expect(await service.bootstrap(OTHER, null, URL)).toEqual({ kind: 'not_found' });
    expect(repo.getOrCreate).not.toHaveBeenCalled();
  });

  it('fails closed when persistence or stored signed continuation cannot be validated', async () => {
    const { service, repo, byKey, deps } = setup();
    repo.getOrCreate.mockRejectedValueOnce(new Error('PRIVATE_DATABASE_DETAIL'));
    await expect(service.bootstrap(ID, null, URL)).rejects.toThrow('PRIVATE_DATABASE_DETAIL');
    const started = await service.bootstrap(ID, null, URL);
    if (started.kind !== 'ready' || !started.setCookie) throw Error('Missing cookie');
    const pair = started.setCookie.split(';')[0]!;
    const digest = [...byKey.keys()][0]!;
    byKey.set(digest, stored(digest, LATER, 'active', [FIRST_FACT]));
    deps.restore.mockResolvedValueOnce(null as never);
    await expect(service.bootstrap(ID, pair, URL)).rejects.toThrow('stored continuation unavailable');
  });
});
