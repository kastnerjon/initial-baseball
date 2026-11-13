import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../../../../serverOfficialDailyEditionRuntime', () => ({
  createServerOfficialDailyEditionRuntime: vi.fn(),
}));

import { GET, POST } from './route';
import { createServerOfficialDailyEditionRuntime } from '../../../../../serverOfficialDailyEditionRuntime';

const ID = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const URL = 'https://initial.test/api/daily/editions/' + ID + '/';
const runtime = {
  getBootstrap: vi.fn(),
  getHintBundle: vi.fn(),
  revealHint: vi.fn(),
  resolveAtBat: vi.fn(),
};
const context = (action: string, puzzleId = ID) => ({
  params: Promise.resolve({ action, puzzleId }),
});
const get = (query = '?date=2026-11-06') => new Request(URL + 'bootstrap' + query);
const post = (action: string, body: unknown, headers: Record<string, string> = {}) => new Request(
  URL + action,
  { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) },
);
const currentHints = [
  { hintType: 'main_decade', hintLabel: 'Era', hintValue: '1990s' },
  { hintType: 'teams', hintLabel: 'Teams', hintValue: 'Example Club' },
  { hintType: 'position', hintLabel: 'Position', hintValue: 'OF' },
  { hintType: 'stats', hintLabel: 'Stats', hintValue: 'HR 100' },
];
const checkpoints = [1, 2, 3, 4].map(revealedCount => ({
  revealedCount, progressionToken: `signed-depth-${revealedCount}`,
}));
const noRuntime = () => expect(createServerOfficialDailyEditionRuntime).not.toHaveBeenCalled();

beforeEach(() => {
  vi.stubEnv('OFFICIAL_DAILY_EDITION_HTTP_ENABLED', 'true');
  vi.mocked(createServerOfficialDailyEditionRuntime).mockReturnValue(runtime as never);
  runtime.getBootstrap.mockResolvedValue({
    rulesetVersion: 'points-v4', puzzle: { id: ID, pitches: [{ initials: 'HP' }] },
    progressionToken: 'opaque-token', hintBundle: { pitchNumber: 1, revealedCount: 0, hints: currentHints, checkpoints },
  });
  runtime.getHintBundle.mockResolvedValue({ hintBundle: { pitchNumber: 1, revealedCount: 1, hints: currentHints, checkpoints: checkpoints.slice(1) } });
  runtime.revealHint.mockResolvedValue({ hint: { hintType: 'main_decade', hintLabel: 'Era', hintValue: 'AUTHORIZED_HINT' }, progressionToken: 'successor' });
  runtime.resolveAtBat.mockResolvedValue({ result: { kind: 'incorrect' }, progressionToken: 'successor', reveal: null, hintBundle: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('default-OFF exact-ID official Daily HTTP adapter', () => {
  it('refuses all actions before obtaining a server runtime while OFF', async () => {
    vi.stubEnv('OFFICIAL_DAILY_EDITION_HTTP_ENABLED', 'false');
    const responses = await Promise.all([
      GET(get(), context('bootstrap')),
      POST(post('hint', { progressionToken: 'opaque' }), context('hint')),
      POST(post('resolve', { progressionToken: 'opaque', giveUp: true }), context('resolve')),
    ]);
    expect(responses.map(response => response.status)).toEqual([404, 404, 404]);
    noRuntime();
  });

  it('returns only the safe bootstrap with no-store and an exact immutable ID', async () => {
    const response = await GET(get(), context('bootstrap'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(createServerOfficialDailyEditionRuntime).toHaveBeenCalledWith(ID);
    expect(runtime.getBootstrap).toHaveBeenCalledWith('2026-11-06');
    expect(await response.json()).toMatchObject({ puzzle: { id: ID }, hintBundle: { pitchNumber: 1, revealedCount: 0, hints: currentHints, checkpoints } });
  });

  it('supports single-hint, resume and unsigned-practice resolution without result submission', async () => {
    const hint = await POST(post('hint', { progressionToken: 'before' }), context('hint'));
    expect(await hint.json()).toMatchObject({ hint: { hintValue: 'AUTHORIZED_HINT' } });
    expect(runtime.revealHint).toHaveBeenCalledWith('before');
    expect((await POST(post('hints', { progressionToken: 'after' }), context('hints'))).status).toBe(200);
    expect(runtime.getHintBundle).toHaveBeenCalledWith('after');
    const resumed = await POST(post('hints', { progressionToken: 'after' }), context('hints'));
    expect(await resumed.json()).toMatchObject({ hintBundle: {
      pitchNumber: 1, revealedCount: 1, hints: currentHints, checkpoints: checkpoints.slice(1),
    } });
    expect((await POST(post('resolve', { progressionToken: 'before', giveUp: true }), context('resolve'))).status).toBe(200);
    expect(runtime.resolveAtBat).toHaveBeenCalledWith({ progressionToken: 'before', giveUp: true });
    expect((await POST(post('resolve', { progressionToken: 'before', submittedPlayerId: 'ibp_ab000000000000000000' }), context('resolve'))).status).toBe(200);
    expect(runtime.resolveAtBat).toHaveBeenCalledWith({
      progressionToken: 'before', submittedPlayerId: 'ibp_ab000000000000000000',
    });
  });

  it.each([
    '', '?date=2026-02-30', '?date=2026-11-06&date=2026-11-07',
    '?date=2026-11-06&includeAnswers=1',
  ])('rejects invalid bootstrap query %s without runtime I/O', async query => {
    expect((await GET(get(query), context('bootstrap'))).status).toBe(400);
    noRuntime();
  });

  it.each([
    ['hint', { progressionToken: '' }],
    ['hint', { progressionToken: 'valid', futureHints: ['PRIVATE_FUTURE_HINT'] }],
    ['hints', { progressionToken: 42 }],
    ['resolve', { progressionToken: 'valid' }],
    ['resolve', { progressionToken: 'valid', giveUp: true, submittedPlayerId: 'ibp_ab000000000000000000' }],
    ['resolve', { progressionToken: 'valid', giveUp: false }],
  ])('rejects hostile %s JSON body without obtaining the runtime', async (action, body) => {
    const response = await POST(post(action, body), context(action));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    noRuntime();
  });

  it('rejects unknown operations, wrong methods, and non-JSON content before runtime I/O', async () => {
    expect((await GET(get(), context('results'))).status).toBe(404);
    expect((await GET(get(), context('hint'))).status).toBe(405);
    expect((await POST(post('bootstrap', { progressionToken: 'x' }), context('bootstrap'))).status).toBe(405);
    expect((await POST(post('hint', { progressionToken: 'x' }, { 'content-type': 'text/plain' }), context('hint'))).status).toBe(400);
    noRuntime();
  });

  it('rejects oversized POST bodies even if Content-Length is absent or forged', async () => {
    const oversized = JSON.stringify({ progressionToken: 'x'.repeat(9000) });
    for (const headers of [
      { 'content-type': 'application/json' },
      { 'content-type': 'application/json', 'content-length': '12' },
    ]) {
      const response = await POST(new Request(URL + 'hint', {
        method: 'POST', headers, body: oversized,
      }), context('hint'));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'invalid_request' });
    }
    noRuntime();
  });

  it('permits a correctly-sized maximum-length signed token envelope', async () => {
    const token = 'x'.repeat(4096);
    const response = await POST(post('hint', { progressionToken: token }), context('hint'));
    expect(response.status).toBe(200);
    expect(runtime.revealHint).toHaveBeenCalledWith(token);
  });

  it('redacts backend diagnostics and refuses malformed edition IDs through the private composer', async () => {
    vi.mocked(createServerOfficialDailyEditionRuntime).mockImplementationOnce(() => {
      throw new Error('PRIVATE_DB_ERROR_OR_TOKEN');
    });
    const failure = await GET(get(), context('bootstrap'));
    expect(failure.status).toBe(503);
    expect(await failure.clone().text()).not.toContain('PRIVATE_DB_ERROR_OR_TOKEN');
    expect(await failure.json()).toEqual({ error: 'unavailable' });
  });
});
