import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));
vi.mock('../../../serverSupabaseClient', () => ({
  createServerSupabaseClient: vi.fn(() => ({ from: vi.fn() })),
}));
vi.mock('../../../serverOfficialDailyEditorialCatalog', () => ({
  listPrivateOfficialDailyEditorialDrafts: vi.fn(),
}));

import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import Page from './page';
import { createServerSupabaseClient } from '../../../serverSupabaseClient';
import { listPrivateOfficialDailyEditorialDrafts } from '../../../serverOfficialDailyEditorialCatalog';

const USER = 'daily-editor';
const PASSWORD = 'a-secure-admin-password-with-32-chars';
const AUTH = 'Basic ' + Buffer.from(USER + ':' + PASSWORD).toString('base64');
const ID = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const PAGE = {
  puzzleDate: '2026-11-06',
  editions: [{
    occurrenceId: ID, puzzleDate: '2026-11-06', puzzleNumber: 194,
    editionKey: 'modern', editionNumber: 2, title: 'Modern',
    status: 'scheduled' as const, revision: 1,
    hiddenClue: 'PRIVATE_HINT_MARKER',
  }],
  nextCursor: 2,
};

const props = (params: Record<string, string | string[] | undefined>) => ({
  searchParams: Promise.resolve(params),
});

beforeEach(() => {
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'true');
  vi.stubEnv('DAILY_ADMIN_USERNAME', USER);
  vi.stubEnv('DAILY_ADMIN_PASSWORD', PASSWORD);
  vi.mocked(headers).mockResolvedValue(new Headers({ authorization: AUTH, 'sec-fetch-site': 'same-origin' }) as never);
  vi.mocked(listPrivateOfficialDailyEditorialDrafts).mockResolvedValue(PAGE);
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('secondary official Daily editor catalog page', () => {
  it('fails closed before authentication and database I/O when the flag is OFF', async () => {
    vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', '');
    await expect(Page(props({ puzzleDate: '2026-11-06' }))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
    expect(headers).not.toHaveBeenCalled();
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('redirects unauthorized editors before reading any private drafts', async () => {
    vi.mocked(headers).mockResolvedValueOnce(new Headers({ authorization: 'Basic invalid' }) as never);
    await expect(Page(props({ puzzleDate: '2026-11-06' }))).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/admin/auth');
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('denies cross-site and ambiguous navigation without private editorial I/O', async () => {
    for (const site of ['cross-site', 'same-site', null]) {
      vi.mocked(headers).mockResolvedValueOnce(new Headers({
        authorization: AUTH,
        ...(site === null ? {} : { 'sec-fetch-site': site }),
      }) as never);
      await expect(Page(props({ puzzleDate: '2026-11-06' })))
        .rejects.toThrow('NEXT_NOT_FOUND');
    }
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
    expect(listPrivateOfficialDailyEditorialDrafts).not.toHaveBeenCalled();
  });

  it('permits direct first-party navigation with site none', async () => {
    vi.mocked(headers).mockResolvedValueOnce(new Headers({
      authorization: AUTH, 'sec-fetch-site': 'none',
    }) as never);
    expect(renderToStaticMarkup(await Page(props({ puzzleDate: '2026-11-06' }))))
      .toContain('Secondary editorial editions');
  });

  it('shows an authenticated empty date-selection form without querying Supabase', async () => {
    const html = renderToStaticMarkup(await Page(props({})));
    expect(html).toContain('Pacific game date');
    expect(html).toContain('Primary Daily editor');
    expect(html).not.toContain('PRIVATE_HINT_MARKER');
    expect(listPrivateOfficialDailyEditorialDrafts).not.toHaveBeenCalled();
  });

  it('renders only metadata, a safe next-page link and no future answers', async () => {
    const html = renderToStaticMarkup(await Page(props({ puzzleDate: '2026-11-06' })));
    expect(html).toContain('Modern');
    expect(html).toContain('scheduled');
    expect(html).toContain(ID);
    expect(html).toContain('/admin/daily/editions/review?occurrenceId=' + ID);
    expect(html).toContain('Review nine players');
    expect(html).toContain('afterEditionNumber=2');
    expect(html).not.toContain('PRIVATE_HINT_MARKER');
    expect(html).not.toContain('canonicalPlayerIds');
    expect(listPrivateOfficialDailyEditorialDrafts).toHaveBeenCalledWith(
      expect.anything(), { puzzleDate: '2026-11-06' },
    );
  });

  it('passes a validated page cursor without choosing a different date', async () => {
    const html = renderToStaticMarkup(await Page(props({
      puzzleDate: '2026-11-06', afterEditionNumber: '2',
    })));
    expect(html).toContain('Secondary editions');
    expect(listPrivateOfficialDailyEditorialDrafts).toHaveBeenCalledWith(
      expect.anything(), { puzzleDate: '2026-11-06', afterEditionNumber: 2 },
    );
  });

  it.each([
    { puzzleDate: ['2026-11-06', '2026-11-07'] },
    { puzzleDate: '2026-02-30' },
    { puzzleDate: '2026-11-06', afterEditionNumber: '-1' },
    { puzzleDate: '2026-11-06', afterEditionNumber: '1.5' },
    { puzzleDate: '2026-11-06', afterEditionNumber: '9007199254740992' },
    { puzzleDate: '2026-11-06', includePlayers: 'true' },
    { afterEditionNumber: '2' },
  ])('rejects invalid and ambiguous query inputs before database access', async params => {
    const html = renderToStaticMarkup(await Page(props(params)));
    expect(html).toContain('Invalid date or page cursor');
    expect(listPrivateOfficialDailyEditorialDrafts).not.toHaveBeenCalled();
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('displays a generic failure without exposing provider diagnostics', async () => {
    vi.mocked(listPrivateOfficialDailyEditorialDrafts).mockRejectedValueOnce(
      new Error('PRIVATE_HINT_MARKER'),
    );
    const html = renderToStaticMarkup(await Page(props({ puzzleDate: '2026-11-06' })));
    expect(html).toContain('Edition metadata is temporarily unavailable');
    expect(html).not.toContain('PRIVATE_HINT_MARKER');
  });
});
