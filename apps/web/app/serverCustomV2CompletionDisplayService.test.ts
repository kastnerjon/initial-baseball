import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import { createCustomLineupV2AttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { createCustomLineupV2CreatorBrowserMarker } from './customNineCreatorBrowser';
import { createServerCustomV2CompletionDisplayService } from './serverCustomV2CompletionDisplayService';
import type {
  CustomV2CompletionDisplayWrite, CustomV2CompletionDisplayRead,
  CustomV2CompletionDisplayChoice,
} from './supabaseCustomV2CompletionDisplayRepository';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174001';
const SECRET = 'private-custom-completion-display-secret-of-adequate-length';
const BROWSER = createCustomLineupV2AttemptBrowserCredential(SECRET).issue(ID, 'https://game.test');
const COOKIE = BROWSER.setCookie.split(';')[0]!;
const CREATOR = createCustomLineupV2CreatorBrowserMarker(SECRET)
  .creatorCookie(ID, 'https://game.test').split(';')[0]!;
const FOREIGN = createCustomLineupV2AttemptBrowserCredential(SECRET)
  .issue(OTHER, 'https://game.test').setCookie.split(';')[0]!;

function setup(flag = 'true') {
  const dependencies = {
    getSecret: vi.fn(() => SECRET),
    write: vi.fn(async (_input: CustomV2CompletionDisplayWrite) =>
      'created' as 'created' | 'existing' | 'conflict'),
    read: vi.fn(async (_input: CustomV2CompletionDisplayRead) =>
      null as CustomV2CompletionDisplayChoice | null),
  };
  const service = createServerCustomV2CompletionDisplayService({
    environment: { CUSTOM_V2_COMPLETION_DISPLAY_ENABLED: flag }, dependencies,
  });
  return { service, dependencies };
}

describe('source-only Custom completion display writer', () => {
  it('has an independent exact-true default-OFF gate before cookie/DB reads', async () => {
    for (const flag of ['', 'false', 'TRUE', ' true ']) {
      const s = setup(flag);
      expect(await s.service.write(ID, COOKIE, { mode: 'named', displayName: 'Guest' }))
        .toEqual({ kind: 'disabled' });
      expect(s.dependencies.getSecret).not.toHaveBeenCalled();
      expect(s.dependencies.write).not.toHaveBeenCalled();
    }
    const defaultService = createServerCustomV2CompletionDisplayService({
      environment: {},
      dependencies: setup().dependencies,
    });
    expect(await defaultService.write(ID, COOKIE, { mode: 'anonymous' }))
      .toEqual({ kind: 'disabled' });
  });

  it('accepts guest name only with matching signed first-attempt browser credential', async () => {
    const s = setup();
    expect(await s.service.write(ID, COOKIE, {
      mode: 'named', displayName: '  Guest Hero  ',
    })).toEqual({ kind: 'saved', status: 'created' });
    expect(s.dependencies.write).toHaveBeenCalledOnce();
    expect(s.dependencies.write).toHaveBeenCalledWith({
      puzzleId: ID, browserKeyDigest: BROWSER.browserKeyDigest,
      choice: { mode: 'named', displayName: 'Guest Hero' },
    }, { CUSTOM_V2_COMPLETION_DISPLAY_ENABLED: 'true' });
    const input = s.dependencies.write.mock.calls[0]![0];
    expect(input).not.toHaveProperty('submissionId');
    expect(input).not.toHaveProperty('accountId');
    expect(input).not.toHaveProperty('score');
  });

  it('supports an explicit anonymous choice and exact transactional retry without leaking names', async () => {
    const s = setup();
    s.dependencies.write.mockResolvedValueOnce('existing');
    expect(await s.service.write(ID, COOKIE, { mode: 'anonymous' }))
      .toEqual({ kind: 'saved', status: 'existing' });
    expect(s.dependencies.write.mock.calls[0]![0].choice)
      .toEqual({ mode: 'anonymous', displayName: null });
  });

  it('denies creator, duplicate, malformed, missing and foreign browser cookies', async () => {
    const s = setup();
    for (const cookie of [
      null, CREATOR, CREATOR + '; ' + COOKIE, COOKIE + '; ' + COOKIE,
      COOKIE.slice(0, -1) + '!', FOREIGN,
    ]) {
      expect(await s.service.write(ID, cookie, { mode: 'named', displayName: 'Guest' }))
        .toEqual({ kind: 'unauthorized' });
    }
    expect(s.dependencies.write).not.toHaveBeenCalled();
  });

  it('fails closed before cookie/DB inspection for malformed modes, JS length and XSS controls', async () => {
    const s = setup();
    for (const [id, choice] of [
      ['custom-nine-v1-123e4567-e89b-42d3-a456-426614174000',
        { mode: 'named', displayName: 'Guest' }],
      [ID, { mode: 'named', displayName: '' }],
      [ID, { mode: 'named', displayName: 'a'.repeat(33) }],
      [ID, { mode: 'named', displayName: '🧢'.repeat(17) }],
      [ID, { mode: 'named', displayName: 'Guest\nName' }],
      [ID, { mode: 'named', displayName: '<script>\u0000' }],
      [ID, { mode: 'anonymous', displayName: 'exposed' }],
      [ID, { mode: 'public', displayName: 'Guest' }],
      [ID, { mode: 'named', displayName: 'Guest', submissionId: 'forged' }],
      [ID, null],
    ] as const) expect(await s.service.write(id, COOKIE, choice))
      .toEqual({ kind: 'invalid' });
    expect(s.dependencies.getSecret).not.toHaveBeenCalled();
    expect(s.dependencies.write).not.toHaveBeenCalled();
  });

  it('leaves markup in valid names as escaped-at-render-time text, never an HTML claim', async () => {
    const s = setup();
    expect(await s.service.write(ID, COOKIE, {
      mode: 'named', displayName: '<script>not executed</script>',
    })).toEqual({ kind: 'saved', status: 'created' });
    expect(s.dependencies.write.mock.calls[0]![0].choice)
      .toEqual({ mode: 'named', displayName: '<script>not executed</script>' });
  });

  it('redacts SQL failures and distinguishes immutable rename conflict without score mutation', async () => {
    const s = setup();
    s.dependencies.write.mockResolvedValueOnce('conflict');
    expect(await s.service.write(ID, COOKIE, { mode: 'named', displayName: 'New Name' }))
      .toEqual({ kind: 'conflict' });
    s.dependencies.write.mockRejectedValueOnce(new Error('PRIVATE_SQL_OWNER_AND_NAME'));
    expect(await s.service.write(ID, COOKIE, { mode: 'anonymous', displayName: null }))
      .toEqual({ kind: 'unavailable' });
    s.dependencies.getSecret.mockImplementationOnce(() => { throw Error('PRIVATE_SECRET'); });
    expect(await s.service.write(ID, COOKIE, { mode: 'anonymous' }))
      .toEqual({ kind: 'unavailable' });
  });
});


describe('source-only Custom display refresh readback', () => {
  it('never reads from an OFF flag or an invalid puzzle', async () => {
    const s = setup('false');
    expect(await s.service.read(ID, COOKIE)).toEqual({ kind: 'disabled' });
    expect(s.dependencies.getSecret).not.toHaveBeenCalled();
    expect(s.dependencies.read).not.toHaveBeenCalled();
    const on = setup();
    expect(await on.service.read('custom-nine-v1-forged', COOKIE))
      .toEqual({ kind: 'invalid' });
    expect(on.dependencies.getSecret).not.toHaveBeenCalled();
    expect(on.dependencies.read).not.toHaveBeenCalled();
  });

  it('reads only the exact signed challenge-scoped attempt without exposing identity keys', async () => {
    const s = setup();
    s.dependencies.read.mockResolvedValueOnce({ mode: 'named', displayName: 'Guest Hero' });
    expect(await s.service.read(ID, COOKIE)).toEqual({
      kind: 'loaded', choice: { mode: 'named', displayName: 'Guest Hero' },
    });
    expect(s.dependencies.read).toHaveBeenCalledWith({
      puzzleId: ID, browserKeyDigest: BROWSER.browserKeyDigest,
    }, { CUSTOM_V2_COMPLETION_DISPLAY_ENABLED: 'true' });
    const output = await s.service.read(ID, COOKIE);
    expect(output).toEqual({ kind: 'loaded', choice: null });
    expect(JSON.stringify(output)).not.toContain(BROWSER.browserKeyDigest);
  });

  it('returns an anonymous saved preference without a nickname or account claim', async () => {
    const s = setup();
    s.dependencies.read.mockResolvedValueOnce({ mode: 'anonymous', displayName: null });
    expect(await s.service.read(ID, COOKIE)).toEqual({
      kind: 'loaded', choice: { mode: 'anonymous', displayName: null },
    });
  });

  it('refuses creator, missing, duplicate, tampered or sibling challenge cookies', async () => {
    const s = setup();
    for (const cookie of [
      null, CREATOR, CREATOR + '; ' + COOKIE, COOKIE + '; ' + COOKIE,
      COOKIE.slice(0, -1) + '!', FOREIGN,
    ]) {
      expect(await s.service.read(ID, cookie)).toEqual({ kind: 'unauthorized' });
    }
    expect(s.dependencies.read).not.toHaveBeenCalled();
  });

  it('redacts private provider failures including stored name and SQL details', async () => {
    const s = setup();
    s.dependencies.read.mockRejectedValueOnce(new Error('PRIVATE_SQL_OWNER_NAME'));
    expect(await s.service.read(ID, COOKIE)).toEqual({ kind: 'unavailable' });
    s.dependencies.getSecret.mockImplementationOnce(() => {
      throw new Error('PRIVATE_SIGNING_SECRET');
    });
    expect(await s.service.read(ID, COOKIE)).toEqual({ kind: 'unavailable' });
  });
});
