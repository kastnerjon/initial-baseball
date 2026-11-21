import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { createServerOfficialDailyCompetitiveGame } from '../../../../../../serverOfficialDailyCompetitiveGame';
import { createOfficialDailyAttemptBrowserCredential } from '../../../../../../customNineAttemptBrowserCredential';
vi.mock('server-only', () => ({}));
vi.mock('../../../../../../serverOfficialDailyCompetitiveGame', () => ({ createServerOfficialDailyCompetitiveGame: vi.fn() }));

const ID = 'daily-ed-v1-11111111-1111-4111-8111-111111111111';
const SIBLING = 'daily-ed-v1-22222222-2222-4222-8222-222222222222';
const ORIGIN = 'https://qa.example';
const SECRET = 'ephemeral-route-test-secret-at-least-32-characters';
const DATE = { date: '2026-11-18' };
const game = {
  readScorecard: vi.fn(), getScorecard: vi.fn(), getBootstrap: vi.fn(), getHintBundle: vi.fn(), resolveAtBat: vi.fn(),
  revealHint: vi.fn(), getPublicPuzzle: vi.fn(),
};

function post(action: string, body: unknown, cookie = '', id = ID, origin = ORIGIN) {
  const url = ORIGIN + '/api/daily/editions/' + id + '/competitive/' + action;
  return POST(new Request(url, {
    method: 'POST', headers: { origin, cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ puzzleId: id, action }) });
}

beforeEach(() => {
  vi.stubEnv('OFFICIAL_DAILY_EDITION_COMPETITIVE_HTTP_ENABLED', 'true');
  vi.stubEnv('OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED', 'true');
  vi.stubEnv('OFFICIAL_DAILY_COMPETITIVE_SECRET', SECRET);
  vi.mocked(createServerOfficialDailyCompetitiveGame).mockReturnValue(game);
  game.getBootstrap.mockResolvedValue({ progressionToken: 'signed-bootstrap' });
  game.resolveAtBat.mockResolvedValue({ progressionToken: 'signed-next' });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('official Daily competitive POST', () => {
  it.each(['OFFICIAL_DAILY_EDITION_COMPETITIVE_HTTP_ENABLED', 'OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED'])(
    'stays inaccessible when %s is off', async flag => {
      vi.stubEnv(flag, 'false');
      const response = await post('bootstrap', DATE);
      expect(response.status).toBe(404);
      expect(response.headers.get('set-cookie')).toBeNull();
      expect(createServerOfficialDailyCompetitiveGame).not.toHaveBeenCalled();
    },
  );
  it('confirms an edition-bound cookie before reserving, then uses existing-only ownership for actions', async () => {
    const first = await post('bootstrap', DATE);
    expect(first.status).toBe(428);
    expect(first.headers.get('cache-control')).toBe('private, no-store');
    expect(createServerOfficialDailyCompetitiveGame).not.toHaveBeenCalled();
    const header = first.headers.get('set-cookie')!;
    expect(header).toContain('; HttpOnly; SameSite=Strict; Secure');
    const cookie = header.split(';')[0]!;
    expect(await (await post('bootstrap', DATE, cookie)).json()).toEqual({ progressionToken: 'signed-bootstrap' });
    const digest = vi.mocked(createServerOfficialDailyCompetitiveGame).mock.calls[0]![1];
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(createServerOfficialDailyCompetitiveGame).toHaveBeenCalledWith(ID, digest, SECRET, 'bootstrap', []);
    expect(await (await post('resolve', { progressionToken: 'signed-bootstrap', giveUp: true }, cookie)).json())
      .toEqual({ progressionToken: 'signed-next' });
    expect(createServerOfficialDailyCompetitiveGame).toHaveBeenLastCalledWith(ID, digest, SECRET, 'existing', []);
    expect(game.resolveAtBat).toHaveBeenCalledWith({ progressionToken: 'signed-bootstrap', giveUp: true });
    expect((await post('hints', { progressionToken: 'signed-next' }, cookie, SIBLING)).status).toBe(403);
    expect((await post('bootstrap', DATE, cookie + '; ' + cookie)).status).toBe(403);
    expect(createServerOfficialDailyCompetitiveGame).toHaveBeenCalledTimes(2);
  });
  it('re-signs a verified old cookie with the active key without changing its attempt digest', async () => {
    const nextSecret = 'new-official-route-signing-key-0123456789abcdef';
    const oldCredentials = createOfficialDailyAttemptBrowserCredential(SECRET);
    const oldCookie = oldCredentials.issue(ID, ORIGIN).setCookie.split(';')[0]!;
    const previous = oldCredentials.inspect(oldCookie, ID);
    expect(previous.kind).toBe('valid');
    if (previous.kind !== 'valid') throw new Error('Old cookie unexpectedly invalid');

    vi.stubEnv('OFFICIAL_DAILY_COMPETITIVE_SECRET', nextSecret);
    vi.stubEnv('OFFICIAL_DAILY_COMPETITIVE_LEGACY_SECRETS_JSON', JSON.stringify([SECRET]));
    game.getScorecard.mockResolvedValue({ status: 'active', revision: 2 });

    const response = await post('scorecard', DATE, oldCookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'active', revision: 2 });
    const replacement = response.headers.get('set-cookie')!;
    expect(replacement).toContain('; HttpOnly; SameSite=Strict; Secure');
    expect(replacement).toContain('Path=/api/daily/editions/' + ID);
    const newCookie = replacement.split(';')[0]!;
    expect(newCookie).not.toBe(oldCookie);
    expect(createOfficialDailyAttemptBrowserCredential(nextSecret).inspect(newCookie, ID))
      .toEqual({ kind: 'valid', browserKeyDigest: previous.browserKeyDigest });
    expect(createServerOfficialDailyCompetitiveGame).toHaveBeenCalledWith(
      ID, previous.browserKeyDigest, nextSecret, 'existing', [SECRET],
    );

    vi.stubEnv('OFFICIAL_DAILY_COMPETITIVE_LEGACY_SECRETS_JSON', '[]');
    expect((await post('scorecard', DATE, oldCookie)).status).toBe(403);
    const current = await post('scorecard', DATE, newCookie);
    expect(current.status).toBe(200);
    expect(current.headers.get('set-cookie')).toBeNull();
    expect((await post('scorecard', DATE, newCookie, SIBLING)).status).toBe(403);
  });

  it('reads an existing scorecard only for its edition credential', async () => {
    const first = await post('bootstrap', DATE);
    const cookie = first.headers.get('set-cookie')!.split(';')[0]!;
    game.getScorecard.mockResolvedValue({ status: 'completed', revision: 9 });
    expect((await post('scorecard', DATE)).status).toBe(403);
    expect((await post('scorecard', DATE, cookie, SIBLING)).status).toBe(403);
    expect((await post('scorecard', { ...DATE, score: 27 }, cookie)).status).toBe(400);
    const response = await post('scorecard', DATE, cookie);
    expect(await response.json()).toEqual({ status: 'completed', revision: 9 });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(createServerOfficialDailyCompetitiveGame).toHaveBeenCalledOnce();
    expect(vi.mocked(createServerOfficialDailyCompetitiveGame).mock.calls[0]![3]).toBe('existing');
    expect(game.getScorecard).toHaveBeenCalledWith(DATE.date);
  });
  it('rejects foreign origins, extra score fields, unconfigured policy and invalid IDs before runtime access', async () => {
    expect((await post('bootstrap', DATE, '', ID, 'https://other.example')).status).toBe(403);
    expect((await post('bootstrap', { ...DATE, score: 36 })).status).toBe(400);
    expect((await post('bootstrap', DATE, '', 'daily-other')).status).toBe(404);
    expect((await post('resolve', { progressionToken: 'a'.repeat(9000), giveUp: true })).status).toBe(400);
    vi.stubEnv('OFFICIAL_DAILY_COMPETITIVE_LEGACY_SECRETS_JSON', '[invalid');
    expect((await post('bootstrap', DATE)).status).toBe(503);
    vi.stubEnv('OFFICIAL_DAILY_COMPETITIVE_LEGACY_SECRETS_JSON', '[]');
    vi.stubEnv('OFFICIAL_DAILY_COMPETITIVE_SECRET', '');
    expect((await post('bootstrap', DATE)).status).toBe(503);
    expect(createServerOfficialDailyCompetitiveGame).not.toHaveBeenCalled();
  });
});
