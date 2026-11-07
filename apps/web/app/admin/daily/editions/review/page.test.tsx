import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));
vi.mock('../../../../serverSupabaseClient', () => ({
  createServerSupabaseClient: vi.fn(() => ({ from: vi.fn() })),
}));
vi.mock('../../../../serverOfficialDailyEditorialDrafts', () => ({
  readOfficialDailyEditorialDraftPreview: vi.fn(),
}));

import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import Page from './page';
import { createServerSupabaseClient } from '../../../../serverSupabaseClient';
import { readOfficialDailyEditorialDraftPreview } from '../../../../serverOfficialDailyEditorialDrafts';

const USER = 'daily-editor';
const PASSWORD = 'a-secure-admin-password-with-32-chars';
const AUTH = 'Basic ' + Buffer.from(USER + ':' + PASSWORD).toString('base64');
const ID = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const PREVIEW = {
  occurrenceId: ID, puzzleDate: '2026-12-05', puzzleNumber: 223,
  editionKey: 'modern', editionNumber: 2, title: 'Modern',
  status: 'draft' as const, revision: 3, canSchedule: true,
  selections: Array.from({ length: 9 }, (_, i) => ({
    slot: i + 1, canonicalPlayerId: 'fixture-' + (i + 1),
    displayName: i === 0 ? '<script>UNTRUSTED</script>' : 'Player ' + (i + 1),
  })),
};
const props = (params: Record<string, string | string[] | undefined>) => ({
  searchParams: Promise.resolve(params),
});
beforeEach(() => {
  vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', 'true');
  vi.stubEnv('DAILY_ADMIN_USERNAME', USER);
  vi.stubEnv('DAILY_ADMIN_PASSWORD', PASSWORD);
  vi.mocked(headers).mockResolvedValue(new Headers({ authorization: AUTH }) as never);
  vi.mocked(readOfficialDailyEditorialDraftPreview).mockResolvedValue(PREVIEW);
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('read-only authenticated exact secondary editor review page', () => {
  it('stays unreachable and performs no reads unless the server flag is exact true', async () => {
    for (const value of ['', 'false', 'TRUE', ' true ']) {
      vi.stubEnv('OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED', value);
      await expect(Page(props({ occurrenceId: ID }))).rejects.toThrow('NEXT_NOT_FOUND');
    }
    expect(notFound).toHaveBeenCalled();
    expect(headers).not.toHaveBeenCalled();
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('redirects missing/incorrect Basic credentials before touching private data', async () => {
    vi.mocked(headers).mockResolvedValueOnce(new Headers() as never);
    await expect(Page(props({ occurrenceId: ID }))).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/admin/auth');
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('renders a manual draft-lookup form without reading a draft', async () => {
    const html = renderToStaticMarkup(await Page(props({})));
    expect(html).toContain('Draft occurrence ID');
    expect(html).toContain('Review lineup');
    expect(html).not.toContain('fixture-1');
    expect(readOfficialDailyEditorialDraftPreview).not.toHaveBeenCalled();
  });

  it.each([
    { occurrenceId: [ID, ID] },
    { occurrenceId: ID, debug: '1' },
    { occurrenceId: 'daily-ed-v1-' + ID },
    { occurrenceId: ID.toUpperCase() },
    { occurrenceId: '' },
  ])('rejects malformed queries before constructing a private client', async query => {
    const html = renderToStaticMarkup(await Page(props(query)));
    expect(html).toContain('Invalid occurrence ID');
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('shows all nine ordered choices, revisions and readiness, not raw hints or HTML', async () => {
    const html = renderToStaticMarkup(await Page(props({ occurrenceId: ID })));
    expect(html).toContain('Modern');
    expect(html).toContain('Current editorial revision');
    expect(html).toContain('fixture-1');
    expect(html).toContain('fixture-9');
    expect(html).toContain('Player 9');
    expect(html).toContain('&lt;script&gt;UNTRUSTED&lt;/script&gt;');
    expect(html).not.toContain('<script>UNTRUSTED</script>');
    expect(html).toContain('All nine players have canonical clue material');
    expect(html).not.toContain('hintValues');
    expect(html).not.toContain('Schedule now');
    expect(readOfficialDailyEditorialDraftPreview)
      .toHaveBeenCalledWith(expect.anything(), ID);
  });

  it('labels unready clues without adding a misleading schedule command', async () => {
    vi.mocked(readOfficialDailyEditorialDraftPreview).mockResolvedValueOnce({
      ...PREVIEW, canSchedule: false,
    });
    const html = renderToStaticMarkup(await Page(props({ occurrenceId: ID })));
    expect(html).toContain('not currently ready to schedule');
    expect(html).not.toContain('Schedule now');
  });

  it('sanitizes private provider errors and does not echo answer details', async () => {
    vi.mocked(readOfficialDailyEditorialDraftPreview)
      .mockRejectedValueOnce(new Error('PRIVATE_FUTURE_HINT_AND_ROSTER'));
    const html = renderToStaticMarkup(await Page(props({ occurrenceId: ID })));
    expect(html).toContain('Draft review is temporarily unavailable');
    expect(html).not.toContain('PRIVATE_FUTURE_HINT_AND_ROSTER');
  });
});
