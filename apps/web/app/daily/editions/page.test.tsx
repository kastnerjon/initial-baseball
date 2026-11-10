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

  it('links same-day published editions only to exact-ID noncompetitive practice', async () => {
    mocked.enabled.mockReturnValue(true);
    mocked.read.mockResolvedValue({ puzzleDate: '2026-11-06', editions: [
      { puzzleId: 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08',
        puzzleDate: '2026-11-06', title: 'Modern', editionNumber: 2, editionKey: 'modern', puzzleNumber: 194 },
      { puzzleId: 'daily-ed-v1-2a65c93c-3f36-4f4b-853f-92e85bb81648',
        puzzleDate: '2026-11-06', title: '70s/80s/90s', editionNumber: 3, editionKey: 'retro', puzzleNumber: 194 },
    ], nextCursor: 3 });
    const html = renderToStaticMarkup(await ChoicePage(args({
      afterEdition: '1', cursorDate: '2026-11-06', utm_campaign: 'x',
    })));
    expect(html).toContain('Play today’s primary Daily Nine');
    expect(html).toContain('Additional published editions can be played for practice');
    expect(html).toContain('Modern');
    expect(html).toContain('70s/80s/90s');
    expect((html.match(/Practice only; scores are not submitted/g) ?? []).length).toBe(2);
    expect(html).toContain('href="/daily/editions/daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08?date=2026-11-06"');
    expect(html).toContain('href="/daily/editions/daily-ed-v1-2a65c93c-3f36-4f4b-853f-92e85bb81648?date=2026-11-06"');
    expect(html).not.toContain('href="/daily/editions/null');
    expect(html).toContain('/daily/editions?afterEdition=3&amp;cursorDate=2026-11-06');
    expect(mocked.read).toHaveBeenCalledWith({
      afterEdition: '1', cursorDate: '2026-11-06',
    });
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
    expect(failed).toContain('Start from today’s first page');
    expect(failed).toContain('Play today’s primary Daily Nine');
    expect(failed).not.toContain('SERVICE_ROLE_PRIVATE_VALUE');
  });
});
