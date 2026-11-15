import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));
vi.mock('../../../../dailyAdminComposition', () => ({
  createDailyAdminContext: vi.fn(() => ({ repository: {} })),
}));
vi.mock('../../../../dailyAdminWorkflow', () => ({
  createDailyAdminWorkflow: vi.fn(() => ({ searchPlayers: vi.fn() })),
}));
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createDailyAdminContext } from '../../../../dailyAdminComposition';
import { createDailyAdminWorkflow } from '../../../../dailyAdminWorkflow';
import Page from './page';

const USER = 'editor';
const PASSWORD = 'a-development-only-admin-password';
const AUTH = 'Basic ' + Buffer.from(USER + ':' + PASSWORD).toString('base64');
const props = (params: Record<string,string|string[]|undefined>) =>
  ({ searchParams: Promise.resolve(params) });
function metadata(site: string | null = 'same-origin', auth = AUTH) {
  return new Headers({ authorization: auth,
    ...(site === null ? {} : { 'sec-fetch-site': site }) });
}
const candidate = (n: number) => ({
  canonicalPlayerId: 'player-' + n, displayName: n === 1
    ? '<script>PRIVATE_HINT_MARKER</script>' : 'Player ' + n,
  yearsPlayedDisplay: '1981–1991', playerType: 'hitter',
  primaryPosition: '1B', teamsDisplay: 'NYM',
  recognizabilityRank: n, revealReady: true, requiresYearDisambiguation: false,
  hintValues: ['UNREVEALED_CLUE'],
});
beforeEach(() => {
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED','true');
  vi.stubEnv('DAILY_ADMIN_USERNAME',USER);
  vi.stubEnv('DAILY_ADMIN_PASSWORD',PASSWORD);
  vi.mocked(headers).mockResolvedValue(metadata() as never);
  vi.mocked(createDailyAdminWorkflow).mockReturnValue({
    searchPlayers: vi.fn(() => [candidate(1), candidate(2)]),
  } as never);
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe('restricted canonical Daily player candidate search', () => {
  it('is default OFF before authentication or candidate work', async () => {
    for (const value of ['', 'false','TRUE',' true ']) {
      vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED',value);
      await expect(Page(props({ q:'Clemente' }))).rejects.toThrow('NEXT_NOT_FOUND');
    }
    expect(headers).not.toHaveBeenCalled();
    expect(createDailyAdminContext).not.toHaveBeenCalled();
  });
  it('requires Basic, then first-party browser metadata before candidate work', async () => {
    vi.mocked(headers).mockResolvedValueOnce(metadata('same-origin','Basic wrong') as never);
    await expect(Page(props({ q:'Clemente' }))).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/admin/auth');
    for (const site of ['cross-site','same-site',null]) {
      vi.mocked(headers).mockResolvedValueOnce(metadata(site) as never);
      await expect(Page(props({ q:'Clemente' }))).rejects.toThrow('NEXT_NOT_FOUND');
    }
    expect(createDailyAdminContext).not.toHaveBeenCalled();
  });
  it('avoids candidate I/O for empty/malformed query', async () => {
    for (const value of [{}, { q:'x' }, { q:['Clemente','Mays'] },
      { q:'A'.repeat(81) }, { q:'Jose\nPrivate' }, { q:'Clemente', extra:'1' }]) {
      const html = renderToStaticMarkup(await Page(props(value)));
      if (Object.keys(value).length !== 0) expect(html).toContain('Invalid player search');
    }
    expect(createDailyAdminContext).not.toHaveBeenCalled();
  });
  it('shows bounded identity-only results, escaping names and never sending hints', async () => {
    vi.mocked(createDailyAdminWorkflow).mockReturnValueOnce({
      searchPlayers: vi.fn(() => Array.from({ length: 30 }, (_, i) => candidate(i + 1))),
    } as never);
    const html = renderToStaticMarkup(await Page(props({ q:'Clemente' })));
    expect(html).toContain('Showing the first 25 matches');
    expect(html).toContain('player-25');
    expect(html).not.toContain('player-26');
    expect(html).toContain('&lt;script&gt;PRIVATE_HINT_MARKER&lt;/script&gt;');
    expect(html).not.toContain('<script>PRIVATE_HINT_MARKER</script>');
    expect(html).not.toContain('UNREVEALED_CLUE');
    expect(html).not.toContain('hintValues');
    expect(createDailyAdminWorkflow).toHaveBeenCalledOnce();
    expect(createDailyAdminContext).toHaveBeenCalledWith({
      authorizationHeader:AUTH,
    });
  });
  it('preserves a draft slot context during search and offers only clue-ready candidates', async () => {
    vi.mocked(createDailyAdminWorkflow).mockReturnValueOnce({
      searchPlayers: vi.fn(() => [candidate(1), { ...candidate(2), revealReady: false }]),
    } as never);
    const html = renderToStaticMarkup(await Page(props({
      q: 'Clemente', occurrenceId: '907f33db-c38f-43c3-8e6b-a3aaf19bbd08', slot: '9',
    })));
    expect(html).toContain('name="occurrenceId"');
    expect(html).toContain('name="slot" value="9"');
    expect(html).toContain('Use for slot 9');
    expect(html).toContain('canonicalPlayerId=player-1');
    expect(html).not.toContain('canonicalPlayerId=player-2');
    expect(html).not.toContain('UNREVEALED_CLUE');
  });

  it('rejects partial, swapped or malformed slot contexts before candidate I/O', async () => {
    const id = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
    for (const params of [
      { q: 'Clemente', slot: '1' },
      { q: 'Clemente', occurrenceId: id },
      { q: 'Clemente', occurrenceId: [id, id], slot: '1' },
      { q: 'Clemente', occurrenceId: id, slot: '0' },
      { q: 'Clemente', occurrenceId: id, slot: '10' },
      { q: 'Clemente', occurrenceId: id.toUpperCase(), slot: '1' },
    ]) {
      const html = renderToStaticMarkup(await Page(props(params)));
      expect(html).toContain('Invalid player search');
      expect(html).not.toContain('Use for slot');
    }
    expect(createDailyAdminContext).not.toHaveBeenCalled();
  });

  it('treats the literal search word invalid as a normal query, not an error sentinel', async () => {
    const html = renderToStaticMarkup(await Page(props({ q: 'invalid' })));
    expect(html).toContain('Matching candidates');
    expect(html).not.toContain('Invalid player search');
  });

  it('reports empty results and sanitizes provider errors', async () => {
    vi.mocked(createDailyAdminWorkflow).mockReturnValueOnce({
      searchPlayers: vi.fn(() => []),
    } as never);
    expect(renderToStaticMarkup(await Page(props({q:'No one'}))))
      .toContain('No matching Daily candidates.');
    vi.mocked(createDailyAdminContext).mockImplementationOnce(() => {
      throw new Error('PRIVATE_CANONICAL_HINT_FAILURE');
    });
    const html = renderToStaticMarkup(await Page(props({q:'Clemente'})));
    expect(html).toContain('Player search is temporarily unavailable');
    expect(html).not.toContain('PRIVATE_CANONICAL_HINT_FAILURE');
  });
});
