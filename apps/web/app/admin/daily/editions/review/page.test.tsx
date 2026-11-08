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
  vi.mocked(headers).mockResolvedValue(new Headers({ authorization: AUTH, 'sec-fetch-site': 'same-origin' }) as never);
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

  it('rejects cross-site, same-site and missing-context private roster navigations', async () => {
    for (const site of ['cross-site', 'same-site', null]) {
      vi.mocked(headers).mockResolvedValueOnce(new Headers({
        authorization: AUTH,
        ...(site === null ? {} : { 'sec-fetch-site': site }),
      }) as never);
      await expect(Page(props({ occurrenceId: ID }))).rejects.toThrow('NEXT_NOT_FOUND');
    }
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
    expect(readOfficialDailyEditorialDraftPreview).not.toHaveBeenCalled();
  });

  it('supports direct first-party navigation with Fetch Metadata none', async () => {
    vi.mocked(headers).mockResolvedValueOnce(new Headers({
      authorization: AUTH, 'sec-fetch-site': 'none',
    }) as never);
    expect(renderToStaticMarkup(await Page(props({ occurrenceId: ID }))))
      .toContain('Reviewed secondary Daily roster');
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
    expect(html).toContain('/admin/daily/editions/players');
    const orderedPositions = Array.from({ length: 9 }, (_, i) =>
      html.indexOf('<code>fixture-' + (i + 1) + '</code>'));
    expect(orderedPositions.every(position => position >= 0)).toBe(true);
    expect(orderedPositions).toEqual([...orderedPositions].sort((a, b) => a - b));
    expect(html).toContain('Player 9');
    expect(html).toContain('&lt;script&gt;UNTRUSTED&lt;/script&gt;');
    expect(html).not.toContain('<script>UNTRUSTED</script>');
    expect(html).toContain('All nine players have canonical clue material');
    expect(html).not.toContain('hintValues');
    expect(html).toContain('Confirm lineup and schedule');
    expect(html).toContain('name="expectedRevision" value="3"');
    expect(html).toContain('type="checkbox" required="" name="confirmed" value="yes"');
    expect(readOfficialDailyEditorialDraftPreview)
      .toHaveBeenCalledWith(expect.anything(), ID);
  });

  it('renders draft-only one-slot edit with all nine choices and current revision', async () => {
    const html = renderToStaticMarkup(await Page(props({ occurrenceId: ID })));
    expect(html).toContain('Replace one player');
    expect(html).toContain('action="/admin/daily/editions/review/replace"');
    expect(html).toContain('name="expectedRevision" value="3"');
    expect(html).toContain('name="canonicalPlayerId"');
    expect(html).toContain('name="slot"');
    for (let i = 1; i <= 9; i++) {
      expect(html).toContain('<option value="' + i + '">');
    }
    expect(html).not.toContain('PRIVATE_FUTURE_HINT_AND_ROSTER');
  });

  it('does not offer player edits after scheduling or issuance', async () => {
    for (const status of ['scheduled', 'issued'] as const) {
      vi.mocked(readOfficialDailyEditorialDraftPreview).mockResolvedValueOnce({
        ...PREVIEW, status, canSchedule: false,
      });
      const html = renderToStaticMarkup(await Page(props({ occurrenceId: ID })));
      expect(html).not.toContain('Replace selected player');
      expect(html).not.toContain('/admin/daily/editions/review/replace');
    }
  });

  it('allows correcting a clue-unready draft without exposing a schedule command', async () => {
    vi.mocked(readOfficialDailyEditorialDraftPreview).mockResolvedValueOnce({
      ...PREVIEW, canSchedule: false,
    });
    const html = renderToStaticMarkup(await Page(props({ occurrenceId: ID })));
    expect(html).toContain('Replace selected player');
    expect(html).not.toContain('Confirm lineup and schedule');
  });

  it('labels unready clues without adding a misleading schedule command', async () => {
    vi.mocked(readOfficialDailyEditorialDraftPreview).mockResolvedValueOnce({
      ...PREVIEW, canSchedule: false,
    });
    const html = renderToStaticMarkup(await Page(props({ occurrenceId: ID })));
    expect(html).toContain('not currently ready to schedule');
    expect(html).not.toContain('Confirm lineup and schedule');
  });

  it('only presents irreversible issuance for a scheduled nine-player revision with both server gates', async () => {
    vi.stubEnv('OFFICIAL_DAILY_EDITOR_ISSUANCE_ENABLED', 'true');
    vi.mocked(readOfficialDailyEditorialDraftPreview).mockResolvedValueOnce({
      ...PREVIEW, status: 'scheduled', revision: 4, canSchedule: false,
    });
    const html = renderToStaticMarkup(await Page(props({ occurrenceId: ID })));
    expect(html).toContain('Confirm and issue immutable edition');
    expect(html).toContain('action="/admin/daily/editions/review/issue"');
    expect(html).toContain('name="expectedRevision" value="4"');
    expect(html).toContain('name="confirmed" value="yes"');
    expect(html).not.toContain('Confirm lineup and schedule');
    expect(html).not.toContain('PRIVATE_FUTURE_HINT_AND_ROSTER');
  });

  it('does not render issuance for a draft, already-issued edition or disabled issuance gate', async () => {
    vi.stubEnv('OFFICIAL_DAILY_EDITOR_ISSUANCE_ENABLED', 'true');
    const draftHtml = renderToStaticMarkup(await Page(props({ occurrenceId: ID })));
    expect(draftHtml).not.toContain('Confirm and issue immutable edition');
    vi.mocked(readOfficialDailyEditorialDraftPreview).mockResolvedValueOnce({
      ...PREVIEW, status: 'issued', revision: 4, canSchedule: false,
    });
    const issuedHtml = renderToStaticMarkup(await Page(props({ occurrenceId: ID })));
    expect(issuedHtml).not.toContain('Confirm and issue immutable edition');
    expect(issuedHtml).toContain('already been issued');
    vi.stubEnv('OFFICIAL_DAILY_EDITOR_ISSUANCE_ENABLED', 'false');
    vi.mocked(readOfficialDailyEditorialDraftPreview).mockResolvedValueOnce({
      ...PREVIEW, status: 'scheduled', revision: 4, canSchedule: false,
    });
    const offHtml = renderToStaticMarkup(await Page(props({ occurrenceId: ID })));
    expect(offHtml).not.toContain('Confirm and issue immutable edition');
  });

  it('sanitizes private provider errors and does not echo answer details', async () => {
    vi.mocked(readOfficialDailyEditorialDraftPreview)
      .mockRejectedValueOnce(new Error('PRIVATE_FUTURE_HINT_AND_ROSTER'));
    const html = renderToStaticMarkup(await Page(props({ occurrenceId: ID })));
    expect(html).toContain('Draft review is temporarily unavailable');
    expect(html).not.toContain('PRIVATE_FUTURE_HINT_AND_ROSTER');
  });
});
