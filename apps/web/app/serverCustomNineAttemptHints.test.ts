import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createCustomNineAttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { createCustomNineCreatorBrowserMarker } from './customNineCreatorBrowser';
import { createCustomNineProgressionTokens, CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import { createServerCustomNineAttemptHintService } from './serverCustomNineAttemptHints';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001';
const SECRET = 'test-secret-long-enough-for-custom-nine-hint-cas-progressions';
const codec = createCustomNineProgressionTokens(SECRET);
const claims = {
  version: 1 as const, rulesetVersion: 'points-v4' as const,
  puzzleId: ID, puzzleDate: CUSTOM_NINE_SESSION_DATE,
  pitchNumber: 1, revealCount: 0 as const, strikeCount: 0 as const,
  outCount: 0 as const, completed: false,
};
const INITIAL = codec.sign(claims);
const NEXT = codec.sign({ ...claims, revealCount: 1 });
const HINT = { hintType: 'teams' as const, hintLabel: 'Teams', hintValue: '1986 Mets' };
const cookies = createCustomNineAttemptBrowserCredential(SECRET).issue(
  ID, 'https://example.test/api/custom-nine/challenges/' + ID + '/attempt/hint',
);
const pair = cookies.setCookie.split(';')[0]!;

function setup() {
  let saved: CustomNineAttemptState | null = {
    challengeId: ID, browserKeyDigest: cookies.browserKeyDigest,
    attemptId: '123e4567-e89b-42d3-a456-426614174010',
    revision: 0, currentProgressionToken: INITIAL, terminalAtBats: [],
    status: 'active', createdAt: '2026-10-10T20:00:00Z',
    updatedAt: '2026-10-10T20:00:00Z', completedAt: null,
  };
  const repo = {
    getByKey: vi.fn(async () => saved === null ? null : { ...saved }),
    advance: vi.fn(async (state: CustomNineAttemptState, action: { progressionToken: string }) => {
      if (saved === null || state.revision !== saved.revision
        || state.currentProgressionToken !== saved.currentProgressionToken
        || saved.status !== 'active') return { status: 'conflict' as const };
      saved = {
        ...saved, revision: saved.revision + 1,
        currentProgressionToken: action.progressionToken,
      };
      return { status: 'advanced' as const, state: { ...saved } };
    }),
  };
  const deps = {
    challengeExists: vi.fn(async () => true),
    repository: vi.fn(() => repo),
    getSecret: vi.fn(() => SECRET),
    revealHint: vi.fn(async () => ({ hint: HINT, progressionToken: NEXT })),
  };
  const service = createServerCustomNineAttemptHintService({ dependencies: deps });
  return {
    service, repo, deps,
    replaceState: (next: CustomNineAttemptState | null) => { saved = next; },
    readState: () => saved,
  };
}
describe('Custom Nine stateful hint progression', () => {
  it('commits one signed hint transition, then prevents replay and retry double-reveal', async () => {
    const { service, repo, deps, readState } = setup();
    const first = await service.reveal(ID, pair, INITIAL);
    expect(first).toEqual({ kind: 'revealed', hint: HINT, progressionToken: NEXT, revision: 1 });
    expect(readState()).toMatchObject({ revision: 1, currentProgressionToken: NEXT });
    expect(repo.advance).toHaveBeenCalledOnce();
    expect(repo.advance).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 0, currentProgressionToken: INITIAL }),
      { progressionToken: NEXT },
    );
    expect(await service.reveal(ID, pair, INITIAL)).toEqual({ kind: 'conflict' });
    expect(deps.revealHint).toHaveBeenCalledOnce();
  });

  it('accepts only one winner when two concurrent callers present the same token', async () => {
    const { service, repo } = setup();
    const result = await Promise.all([service.reveal(ID, pair, INITIAL), service.reveal(ID, pair, INITIAL)]);
    expect(result.map(x => x.kind).sort()).toEqual(['conflict', 'revealed']);
    expect(repo.advance).toHaveBeenCalledTimes(2);
  });

  it('returns 404 for a valid-shaped but unissued challenge before cookie eligibility', async () => {
    const s = setup();
    s.deps.challengeExists.mockResolvedValueOnce(false);
    expect(await s.service.reveal(OTHER, null, INITIAL)).toEqual({ kind: 'not_found' });
    expect(s.deps.getSecret).not.toHaveBeenCalled();
    expect(s.repo.getByKey).not.toHaveBeenCalled();
    expect(s.deps.revealHint).not.toHaveBeenCalled();
  });

  it('rejects no/invalid/duplicate credentials and the creator before mutation', async () => {
    const { service, repo, deps } = setup();
    const creator = createCustomNineCreatorBrowserMarker(SECRET)
      .creatorCookie(ID, 'https://example.test').split(';')[0]!;
    for (const cookie of [null, 'garbage=1', pair + '; ' + pair, pair.replace(/.$/, '!'), creator,
      creator.split('=')[0] + '=tampered']) {
      expect(await service.reveal(ID, cookie, INITIAL)).toEqual({ kind: 'invalid_credential' });
    }
    expect(repo.getByKey).not.toHaveBeenCalled();
    expect(deps.revealHint).not.toHaveBeenCalled();
  });

  it('rejects cross-challenge, Universal, tampered and exhausted signed tokens', async () => {
    const { service, repo } = setup();
    for (const token of [
      codec.sign({ ...claims, puzzleId: OTHER }),
      codec.sign({ ...claims, puzzleDate: '2026-10-10' }),
      codec.sign({ ...claims, revealCount: 4 }),
      INITIAL.slice(0, -2) + 'zz',
      'not-a-signed-token',
    ]) {
      expect(await service.reveal(ID, pair, token)).toEqual({ kind: 'invalid_progression' });
    }
    expect(await service.reveal('invalid-id', pair, INITIAL)).toEqual({ kind: 'not_found' });
    expect(repo.getByKey).not.toHaveBeenCalled();
  });

  it('fails closed when the private attempt is missing/completed', async () => {
    const s = setup();
    s.replaceState(null);
    expect(await s.service.reveal(ID, pair, INITIAL)).toEqual({ kind: 'invalid_credential' });
    const s2 = setup();
    s2.replaceState({ ...s2.readState()!, status: 'completed', completedAt: '2026-10-10T21:00:00Z' });
    expect(await s2.service.reveal(ID, pair, INITIAL)).toEqual({ kind: 'completed' });
    expect(s2.repo.advance).not.toHaveBeenCalled();
  });

  it('rejects a malformed or unrelated signed successor without persistence', async () => {
    for (const successor of [
      'forged-result', INITIAL,
      codec.sign({ ...claims, revealCount: 1, strikeCount: 1 }),
      codec.sign({ ...claims, revealCount: 2 }),
      codec.sign({ ...claims, revealCount: 1, pitchNumber: 2 }),
    ]) {
      const s = setup();
      s.deps.revealHint.mockResolvedValueOnce({ hint: HINT, progressionToken: successor });
      await expect(s.service.reveal(ID, pair, INITIAL))
        .rejects.toThrow('Invalid Custom Nine signed hint transition');
      expect(s.repo.advance).not.toHaveBeenCalled();
    }
  });

  it('returns a conflict on a losing conditional UPDATE without exposing a hint', async () => {
    const s = setup();
    s.repo.advance.mockResolvedValueOnce({ status: 'conflict' } as never);
    expect(await s.service.reveal(ID, pair, INITIAL)).toEqual({ kind: 'conflict' });
  });
});
