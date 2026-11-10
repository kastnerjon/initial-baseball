import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import { createCustomLineupV2AttemptBrowserCredential, createCustomNineAttemptBrowserCredential }
  from './customNineAttemptBrowserCredential';
import { createCustomLineupV2CreatorBrowserMarker } from './customNineCreatorBrowser';
import { createServerCustomV2CompletionDisplayService }
  from './serverCustomV2CompletionDisplay';
import type { CustomV2DisplayWrite } from './supabaseCustomV2CompletionDisplayRepository';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174001';
const OLD = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const SECRET = 'private-custom-v2-completion-display-test-secret';
const BROWSER = createCustomLineupV2AttemptBrowserCredential(SECRET).issue(ID,'https://example.test');
const COOKIE = BROWSER.setCookie.split(';')[0]!;
const CREATOR = createCustomLineupV2CreatorBrowserMarker(SECRET).creatorCookie(
  ID,'https://example.test').split(';')[0]!;
function setup(value = 'true') {
  const environment = { CUSTOM_V2_COMPLETION_DISPLAY_ENABLED: value };
  const dependencies = {
    getSecret: vi.fn(() => SECRET),
    record: vi.fn(async (_input: CustomV2DisplayWrite) => 'created' as 'created' | 'existing'),
  };
  return { dependencies, service: createServerCustomV2CompletionDisplayService({
    environment, dependencies,
  }) };
}

describe('default-OFF signed guest Custom v2 completion display service', () => {
  it('is completely disabled for all values other than exact true before auth or DB', async () => {
    for (const value of ['', 'false', 'TRUE', ' true ', '0']) {
      const s = setup(value);
      expect(await s.service.record(ID, COOKIE, { mode: 'named', displayName: 'Avi' }))
        .toEqual({ kind: 'disabled' });
      expect(s.dependencies.getSecret).not.toHaveBeenCalled();
      expect(s.dependencies.record).not.toHaveBeenCalled();
    }
    const unconfigured = createServerCustomV2CompletionDisplayService({
      environment: {}, dependencies: setup().dependencies,
    });
    expect(await unconfigured.record(ID, COOKIE, { mode: 'anonymous' }))
      .toEqual({ kind: 'disabled' });
  });
  it('authenticates the exact signed first browser before saving a normalized name', async () => {
    const s = setup();
    expect(await s.service.record(ID, COOKIE, { mode: 'named', displayName: '  Zoë & Avi  ' }))
      .toEqual({ kind: 'saved', status: 'created' });
    expect(s.dependencies.record).toHaveBeenCalledWith({
      challengeId: ID, browserKeyDigest: BROWSER.browserKeyDigest,
      choice: { mode: 'named', displayName: 'Zoë & Avi' },
    }, { CUSTOM_V2_COMPLETION_DISPLAY_ENABLED: 'true' });
    expect(JSON.stringify(s.dependencies.record.mock.calls)).not.toContain('submissionId');
    expect(JSON.stringify(s.dependencies.record.mock.calls)).not.toContain('PRIVATE_');
  });
  it('keeps Anonymous name-free and idempotent retries server-owned', async () => {
    const s = setup();
    s.dependencies.record.mockResolvedValueOnce('existing');
    expect(await s.service.record(ID, COOKIE, { mode: 'anonymous' }))
      .toEqual({ kind: 'saved', status: 'existing' });
    expect(s.dependencies.record).toHaveBeenCalledWith({
      challengeId: ID, browserKeyDigest: BROWSER.browserKeyDigest,
      choice: { mode: 'anonymous', displayName: null },
    }, expect.anything());
  });
  it('rejects invalid names, arbitrary fields and malformed mode before credentials or DB', async () => {
    const s = setup();
    for (const value of [
      null, '', {}, [], { mode: 'anonymous', displayName: 'LEAK' },
      { mode: 'anonymous', submissionId: 'IMPERSONATION' },
      { mode: 'named' }, { mode: 'named', displayName: '' },
      { mode: 'named', displayName: 'x'.repeat(33) },
      { mode: 'named', displayName: '😀'.repeat(17) },
      { mode: 'named', displayName: 'New\nLine' },
      { mode: 'named', displayName: 'Avi', score: 9999 },
      { mode: 'named', displayName: 'Avi', submissionId: 'FOREIGN' },
      { mode: 'named', displayName: ['Avi'] },
      { mode: 'owned', displayName: 'Avi' },
    ]) {
      expect(await s.service.record(ID, COOKIE, value)).toEqual({ kind: 'invalid_choice' });
    }
    expect(s.dependencies.getSecret).not.toHaveBeenCalled();
    expect(s.dependencies.record).not.toHaveBeenCalled();
  });
  it('refuses invalid puzzle IDs, v1 and arbitrary submissions before any private lookup', async () => {
    const s = setup();
    for (const value of [null, {}, OLD, 'custom-lineup-v2-foo', ID.toUpperCase()]) {
      expect(await s.service.record(value, COOKIE, { mode: 'anonymous' }))
        .toEqual({ kind: 'not_found' });
    }
    expect(s.dependencies.getSecret).not.toHaveBeenCalled();
    expect(s.dependencies.record).not.toHaveBeenCalled();
  });
  it('refuses creator, malformed, foreign, duplicate and legacy attempt cookies', async () => {
    const s = setup();
    const v1 = createCustomNineAttemptBrowserCredential(SECRET)
      .issue(OLD,'https://example.test').setCookie.split(';')[0]!;
    const foreign = createCustomLineupV2AttemptBrowserCredential(SECRET)
      .issue(OTHER,'https://example.test').setCookie.split(';')[0]!;
    for (const header of [
      null, '', CREATOR, CREATOR + '; ' + COOKIE,
      COOKIE + '; ' + COOKIE, COOKIE.slice(0,-1)+'!', foreign, v1,
    ]) {
      expect(await s.service.record(ID, header, { mode: 'named', displayName: 'Avi' }))
        .toEqual({ kind: 'invalid_credential' });
    }
    expect(s.dependencies.record).not.toHaveBeenCalled();
  });
  it('fails closed and does not divulge DB conflict or attempted impersonation details', async () => {
    const s = setup();
    s.dependencies.record.mockRejectedValueOnce(new Error('PRIVATE_DB_CREATOR_OR_SCORE'));
    await expect(s.service.record(ID, COOKIE, { mode: 'anonymous' })).rejects.toThrow(
      'Private Custom Lineup v2 completion display unavailable.',
    );
    s.dependencies.record.mockResolvedValueOnce('malformed' as never);
    await expect(s.service.record(ID, COOKIE, { mode: 'anonymous' })).rejects.toThrow(
      'Private Custom Lineup v2 completion display unavailable.',
    );
  });
});
