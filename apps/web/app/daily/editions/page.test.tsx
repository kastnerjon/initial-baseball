import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  enabled: vi.fn(), read: vi.fn(), archiveVisible: vi.fn(), competitiveVisible: vi.fn(),
  notFound: vi.fn((): never => { throw new Error('NOT_FOUND'); }),
}));
vi.mock('next/navigation', () => ({ notFound: mocked.notFound }));
vi.mock('../../serverOfficialDailyArchiveSection', () => ({
  isOfficialDailyArchiveVisible: mocked.archiveVisible,
}));
vi.mock('../../serverOfficialDailyEditionChoice', () => ({
  isOfficialDailyEditionChooserVisible: mocked.enabled,
  isOfficialDailyEditionCompetitivePreviewVisible: mocked.competitiveVisible,
  readCurrentOfficialDailyEditionChoice: mocked.read,
}));
import ChoicePage, { metadata } from './page';

beforeEach(() => {
  vi.clearAllMocks();
  mocked.enabled.mockReturnValue(false);
  mocked.archiveVisible.mockReturnValue(false);
  mocked.competitiveVisible.mockReturnValue(false);
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

  it('labels same-day exact-ID editions as practice when the competitive Preview gate is OFF', async () => {
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


  it('uses the destination competitive-preview predicate for scored chooser links', async () => {
    mocked.enabled.mockReturnValue(true);
    mocked.competitiveVisible.mockReturnValue(true);
    mocked.read.mockResolvedValue({ puzzleDate: '2026-11-06', editions: [
      { puzzleId: 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08',
        puzzleDate: '2026-11-06', title: 'Same roster A', editionNumber: 2,
        editionKey: 'same-a', puzzleNumber: 194 },
      { puzzleId: 'daily-ed-v1-2a65c93c-3f36-4f4b-853f-92e85bb81648',
        puzzleDate: '2026-11-06', title: 'Same roster B', editionNumber: 3,
        editionKey: 'same-b', puzzleNumber: 194 },
    ], nextCursor: null });
    const html = renderToStaticMarkup(await ChoicePage(args()));
    expect(html).toContain('Additional published editions support scored play');
    expect((html.match(/Scored play; results count for this edition/g) ?? []).length).toBe(2);
    expect(html).toContain('href="/daily/editions/daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08?date=2026-11-06"');
    expect(html).toContain('href="/daily/editions/daily-ed-v1-2a65c93c-3f36-4f4b-853f-92e85bb81648?date=2026-11-06"');
    expect(html).not.toContain('Practice only; scores are not submitted');
    expect(html).not.toContain('competitive scores are not submitted');
    expect(html).not.toContain('correctPlayerIds');
    expect(html).not.toContain('clue_snapshot');
    expect(html).not.toContain('Leaderboard');
    expect(mocked.read).toHaveBeenCalledOnce();
  });

  it('labels the Archive beta destination accurately unless official Archive is actually enabled', async () => {
    mocked.enabled.mockReturnValue(true);
    const beta = renderToStaticMarkup(await ChoicePage(args()));
    expect(beta).toContain('href="/archive">Archive beta (earlier test puzzles)</a>');
    expect(beta).not.toContain('Earlier official Daily puzzles');
    mocked.archiveVisible.mockReturnValue(true);
    const official = renderToStaticMarkup(await ChoicePage(args()));
    expect(official).toContain('href="/archive">Earlier official Daily puzzles</a>');
    expect(official).not.toContain('Archive beta (earlier test puzzles)');
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
