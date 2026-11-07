import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  enabled: vi.fn(), read: vi.fn(),
  notFound: vi.fn((): never => { throw new Error('NOT_FOUND'); }),
}));
vi.mock('next/navigation', () => ({ notFound: mocked.notFound }));
vi.mock('../../serverOfficialDailyEditionChoice', () => ({
  isOfficialDailyEditionChooserVisible: mocked.enabled,
  readCurrentOfficialDailyEditionChoice: mocked.read,
}));
import ChoicePage, { metadata } from './page';

beforeEach(() => {
  vi.clearAllMocks();
  mocked.enabled.mockReturnValue(false);
  mocked.read.mockResolvedValue({ puzzleDate: '2026-11-06', editions: [], nextCursor: null });
});
const args = (searchParams: Record<string, string | string[] | undefined> = {}) =>
  ({ searchParams: Promise.resolve(searchParams) });

describe('Daily edition choice page', () => {
  it('fails closed with no metadata reads or indexing when OFF', async () => {
    await expect(ChoicePage(args({ afterEdition: '3' }))).rejects.toThrow('NOT_FOUND');
    expect(mocked.read).not.toHaveBeenCalled();
    expect(metadata.robots.index).toBe(false);
  });

  it('renders the primary and two distinct exact-ID same-day practice links with pagination', async () => {
    mocked.enabled.mockReturnValue(true);
    mocked.read.mockResolvedValue({ puzzleDate: '2026-11-06', editions: [
      { puzzleId: 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08',
        puzzleDate: '2026-11-06', title: 'Modern', editionNumber: 1, editionKey: 'modern', puzzleNumber: 194 },
      { puzzleId: 'daily-ed-v1-2a65c93c-3f36-4f4b-853f-92e85bb81648',
        puzzleDate: '2026-11-06', title: '70s/80s/90s', editionNumber: 2, editionKey: 'retro', puzzleNumber: 194 },
    ], nextCursor: 2 });
    const html = renderToStaticMarkup(await ChoicePage(args({ afterEdition: '1', utm_campaign: 'x' })));
    expect(html).toContain('Play today’s primary Daily Nine');
    expect(html).toContain('Additional editions are practice-only');
    expect(html).toContain('/daily/editions/daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08?date=2026-11-06');
    expect(html).toContain('/daily/editions/daily-ed-v1-2a65c93c-3f36-4f4b-853f-92e85bb81648?date=2026-11-06');
    expect(html).toContain('/daily/editions?afterEdition=2');
    expect(mocked.read).toHaveBeenCalledWith({ afterEdition: '1' });
    expect(html).not.toContain('correctPlayerIds');
    expect(html).not.toContain('Leaderboard');
  });

  it('handles empty editions and sanitizes reader failures without hiding primary Daily', async () => {
    mocked.enabled.mockReturnValue(true);
    const html = renderToStaticMarkup(await ChoicePage(args()));
    expect(html).toContain('No additional editions are available today.');
    mocked.read.mockRejectedValue(new Error('SERVICE_ROLE_PRIVATE_VALUE'));
    const failed = renderToStaticMarkup(await ChoicePage(args()));
    expect(failed).toContain('Additional Daily puzzles are temporarily unavailable.');
    expect(failed).toContain('Play today’s primary Daily Nine');
    expect(failed).not.toContain('SERVICE_ROLE_PRIVATE_VALUE');
  });
});
