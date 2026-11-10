import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createCustomLineupV2AttemptBrowserCredential, createCustomNineAttemptBrowserCredential }
  from './customNineAttemptBrowserCredential';
import { createCustomLineupV2CreatorBrowserMarker } from './customNineCreatorBrowser';
import { createServerCustomV2CompletionDisplayReadService }
  from './serverCustomV2CompletionDisplayRead';
import type { CustomV2StoredDisplay } from './supabaseCustomV2CompletionDisplayReadRepository';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174001';
const OLD = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const SECRET = 'custom-v2-private-display-readback-test-secret';
const signed = createCustomLineupV2AttemptBrowserCredential(SECRET).issue(ID,'https://example.test');
const COOKIE = signed.setCookie.split(';')[0]!;
const CREATOR = createCustomLineupV2CreatorBrowserMarker(SECRET)
  .creatorCookie(ID,'https://example.test').split(';')[0]!;
function setup(mode: string | null = 'true') {
  const environment = mode === null ? {} : { CUSTOM_V2_COMPLETION_DISPLAY_ENABLED: mode };
  const dependencies = {
    getSecret: vi.fn(() => SECRET),
    read: vi.fn(async (_id: string, _digest: string): Promise<CustomV2StoredDisplay | null> =>
      ({ mode: 'named', displayName: 'Guest' })),
  };
  return { service: createServerCustomV2CompletionDisplayReadService({
    environment, dependencies,
  }), dependencies };
}
describe('default-OFF private signed Custom v2 completion readback', () => {
  it('does not contact auth or SQL when flag is unset or malformed', async () => {
    for (const value of [null,'','false','TRUE',' true ']) {
      const s = setup(value);
      expect(await s.service.read(ID, COOKIE)).toEqual({ kind: 'disabled' });
      expect(s.dependencies.getSecret).not.toHaveBeenCalled();
      expect(s.dependencies.read).not.toHaveBeenCalled();
    }
  });
  it('returns only the exact signed guest display choice, not a submitted result ID', async () => {
    const s = setup();
    expect(await s.service.read(ID, COOKIE)).toEqual({
      kind: 'found', display: { mode: 'named', displayName: 'Guest' },
    });
    expect(s.dependencies.read).toHaveBeenCalledWith(ID, signed.browserKeyDigest,
      { CUSTOM_V2_COMPLETION_DISPLAY_ENABLED: 'true' });
    expect(JSON.stringify(s.dependencies.read.mock.calls)).not.toContain('submissionId');
    s.dependencies.read.mockResolvedValueOnce({ mode: 'anonymous', displayName: null });
    expect(await s.service.read(ID, COOKIE)).toEqual({
      kind: 'found', display: { mode: 'anonymous', displayName: null },
    });
    s.dependencies.read.mockResolvedValueOnce(null);
    expect(await s.service.read(ID, COOKIE)).toEqual({ kind: 'not_set' });
  });
  it('rejects old, malformed, duplicate, foreign or creator credentials', async () => {
    const s = setup();
    const foreign = createCustomLineupV2AttemptBrowserCredential(SECRET)
      .issue(OTHER,'https://example.test').setCookie.split(';')[0]!;
    const v1 = createCustomNineAttemptBrowserCredential(SECRET)
      .issue(OLD,'https://example.test').setCookie.split(';')[0]!;
    for (const cookie of [
      null, '', CREATOR, CREATOR+'; '+COOKIE, COOKIE+'; '+COOKIE,
      COOKIE.slice(0,-1)+'!',foreign,v1,
    ]) expect(await s.service.read(ID,cookie)).toEqual({ kind: 'invalid_credential' });
    expect(s.dependencies.read).not.toHaveBeenCalled();
  });
  it('rejects invalid challenge and foreign v1 puzzle before signing or querying', async () => {
    const s = setup();
    for (const id of [null, OLD, ID.toUpperCase(), 'custom-lineup-v2-invalid']) {
      expect(await s.service.read(id,COOKIE)).toEqual({ kind: 'not_found' });
    }
    expect(s.dependencies.getSecret).not.toHaveBeenCalled();
    expect(s.dependencies.read).not.toHaveBeenCalled();
  });
  it('redacts private provider failures and invalid result variants', async () => {
    const s = setup();
    s.dependencies.read.mockRejectedValueOnce(new Error('PRIVATE_SCORE_AND_NAME'));
    await expect(s.service.read(ID,COOKIE)).rejects.toThrow(
      'Private Custom Lineup v2 completion display unavailable.');
    s.dependencies.read.mockResolvedValueOnce({ mode: 'anonymous', displayName: 'LEAK' } as never);
    await expect(s.service.read(ID,COOKIE)).rejects.toThrow(
      'Private Custom Lineup v2 completion display unavailable.');
    s.dependencies.getSecret.mockImplementationOnce(() => { throw new Error('PRIVATE_SECRET'); });
    await expect(s.service.read(ID,COOKIE)).rejects.toThrow(
      'Private Custom Lineup v2 completion display unavailable.');
  });
});
