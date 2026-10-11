import { describe, expect, it, vi } from 'vitest';
import type { CustomNineBootstrapResponse } from './serverCustomNineBootstrap';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';

vi.mock('server-only', () => ({}));

import { createCustomNineCreatorBrowserMarker } from './customNineCreatorBrowser';
import { createServerCustomNineAttemptBootstrap } from './serverCustomNineAttemptBootstrap';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001';
const SECRET = 'test-progression-key-long-enough-for-custom-attempt-issuance';
const URL = 'https://example.test/api/custom-nine/challenges/' + ID + '/attempt/bootstrap';
const OPEN = 'v1.initial-signature.token';
const stored = (digest: string, token = OPEN, status: 'active' | 'completed' = 'active'): CustomNineAttemptState => ({
  challengeId: ID, browserKeyDigest: digest,
  attemptId: '123e4567-e89b-42d3-a456-426614174010',
  revision: token === OPEN ? 0 : 1,
  currentProgressionToken: token, terminalAtBats: [],
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
      hintBundle: { ...BASE.hintBundle, pitchNumber: token.includes('later') ? 2 : 1 },
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
    expect(result.setCookie).toContain('; HttpOnly; SameSite=Strict; Secure');
    expect(result.setCookie).not.toContain('Domain=');
    expect(result.setCookie).not.toContain('attempt_id');
    expect(repo.getOrCreate).toHaveBeenCalledOnce();
    expect(repo.getByKey).not.toHaveBeenCalled();
    expect(deps.restore).not.toHaveBeenCalled();
  });

  it('resumes existing challenge state with the original token, no new cookie or insert', async () => {
    const { service, repo, byKey, deps } = setup();
    const first = await service.bootstrap(ID, null, URL);
    if (first.kind !== 'ready' || first.setCookie === null) throw Error('Missing issued cookie');
    const pair = first.setCookie.split(';')[0]!;
    const digest = [...byKey.keys()][0]!;
    byKey.set(digest, stored(digest, 'v1.later-signed-token'));
    const resumed = await service.bootstrap(ID, pair, URL);
    expect(resumed).toMatchObject({
      kind: 'ready', setCookie: null, bootstrap: {
        progressionToken: 'v1.later-signed-token', hintBundle: { pitchNumber: 2 },
      },
    });
    expect(repo.getOrCreate).toHaveBeenCalledTimes(1);
    expect(repo.getByKey).toHaveBeenCalledOnce();
    expect(deps.restore).toHaveBeenCalledWith(ID, 'v1.later-signed-token');
    const replay = await service.bootstrap(ID, pair, URL);
    expect(replay.kind).toBe('ready');
    expect(repo.getOrCreate).toHaveBeenCalledTimes(1);
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
    byKey.set(digest, stored(digest, 'v1.later-signed-token'));
    deps.restore.mockResolvedValueOnce(null as never);
    await expect(service.bootstrap(ID, pair, URL)).rejects.toThrow('stored continuation unavailable');
  });
});
