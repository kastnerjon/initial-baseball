import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DAILY_HINT_CONFIG, DEFAULT_DAILY_STATS_HINT_CONFIG } from '@initial-baseball/shared';

const mocked = vi.hoisted(() => ({
  notFound: vi.fn((): never => { throw new Error('NOT_FOUND'); }),
  createRuntime: vi.fn(),
  dailyGame: vi.fn(),
  readChoice: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ notFound: mocked.notFound }));
vi.mock('../../../serverOfficialDailyEditionRuntime', () => ({
  createServerOfficialDailyEditionRuntime: mocked.createRuntime,
}));
vi.mock('../../../components/DailyInningGame', () => ({
  DailyInningGame: (props: unknown) => {
    mocked.dailyGame(props);
    return React.createElement('div', { 'data-testid': 'shared-daily-game' });
  },
}));
vi.mock('../../../components/DailyHowToDialog', () => ({
  DailyHowToDialog: () => React.createElement('div', { 'data-testid': 'how-to' }),
}));

vi.mock('../../../serverOfficialDailyEditionChoice', () => ({
  isOfficialDailyEditionChooserVisible: vi.fn(() => false),
  readCurrentOfficialDailyEditionChoice: mocked.readChoice,
}));

import OfficialDailyPracticePage, { metadata } from './page';
import ChoicePage from '../page';
import { isOfficialDailyEditionChooserVisible } from '../../../serverOfficialDailyEditionChoice';
import { UnifiedOfficialDailyArchiveSection } from '../../../archive/UnifiedOfficialDailyArchiveSection';
const ID = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const DATE = '2026-11-06';
const URL = `/daily/editions/${ID}?date=${DATE}`;
function input(puzzleId = ID, query: Record<string,string|string[]|undefined> = { date: DATE }) {
  return { params: Promise.resolve({ puzzleId }), searchParams: Promise.resolve(query) };
}
function enable() {
  vi.stubEnv('OFFICIAL_DAILY_EDITION_PRACTICE_UI_ENABLED', 'true');
  vi.stubEnv('OFFICIAL_DAILY_EDITION_HTTP_ENABLED', 'true');
  vi.stubEnv('OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED', 'true');
}
function safeBootstrap(puzzleId = ID, date = DATE) {
  return {
    puzzle: {
      id: puzzleId, puzzleDate: date, puzzleNumber: 194, status: 'published',
      hintConfig: DEFAULT_DAILY_HINT_CONFIG.map(slot => ({ ...slot })),
      statsHintConfig: {
        hitter: [...DEFAULT_DAILY_STATS_HINT_CONFIG.hitter],
        pitcher: [...DEFAULT_DAILY_STATS_HINT_CONFIG.pitcher],
      },
      pitches: Array.from({ length: 9 }, (_, index) => ({
        pitchNumber: index + 1, initials: 'PP',
      })),
    },
    rulesetVersion: 'points-v4', progressionToken: 'signed-token',
    hintBundle: { pitchNumber: 1, revealedCount: 0, hints: [], checkpoints: [] },
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.mocked(isOfficialDailyEditionChooserVisible).mockReturnValue(false);
  mocked.createRuntime.mockReturnValue({
    getBootstrap: vi.fn(async () => safeBootstrap()),
  });
});

describe('default-OFF exact-ID official Daily practice page', () => {
  it('is not indexed or described with private answer details', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false, nocache: true });
    expect(JSON.stringify(metadata)).not.toContain(ID);
  });
  it('does not touch runtime when any independent gate is disabled', async () => {
    const flags = ['OFFICIAL_DAILY_EDITION_PRACTICE_UI_ENABLED',
      'OFFICIAL_DAILY_EDITION_HTTP_ENABLED',
      'OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED'] as const;
    for (const missing of flags) {
      enable();
      vi.stubEnv(missing, 'false');
      await expect(OfficialDailyPracticePage(input())).rejects.toThrow('NOT_FOUND');
    }
    expect(mocked.createRuntime).not.toHaveBeenCalled();
  });
  it('rejects invalid edition IDs, dates, arrays or unexpected query keys before runtime I/O', async () => {
    enable();
    for (const args of [
      input('daily-2026-11-06'), input('../api/daily/resolve'), input('daily-ed-v1-INVALID'),
      input(ID, { date: '2026-02-30' }),
      input(ID, { date: ['2026-11-06', '2026-11-07'] }),
      input(ID, { date: DATE, exposeAnswers: '1' }),
      input(ID, {}),
    ]) {
      await expect(OfficialDailyPracticePage(args)).rejects.toThrow('NOT_FOUND');
    }
    expect(mocked.createRuntime).not.toHaveBeenCalled();
  });
  it('rejects private hint-layout fields before a bootstrap crosses the client-prop boundary', async () => {
    enable();
    const safe = safeBootstrap();
    for (const malicious of [
      { ...safe, puzzle: { ...safe.puzzle,
        hintConfig: safe.puzzle.hintConfig.map((slot, index) => index === 0
          ? { ...slot, answers: ['PRIVATE_FUTURE_HINT'] } : slot) } },
      { ...safe, puzzle: { ...safe.puzzle,
        statsHintConfig: { ...safe.puzzle.statsHintConfig, answers: ['PRIVATE_FUTURE_HINT'] } } },
      { ...safe, puzzle: { ...safe.puzzle, correctPlayerIds: ['PRIVATE_FUTURE_HINT'] } },
      { ...safe, puzzle: { ...safe.puzzle, puzzleNumber: { answers: ['PRIVATE_FUTURE_HINT'] } } },
      { ...safe, hintBundle: { ...safe.hintBundle,
        checkpoints: [{ revealedCount: 4, progressionToken: 'PRIVATE_FUTURE_HINT' }] } },
    ]) {
      mocked.createRuntime.mockReturnValueOnce({ getBootstrap: vi.fn(async () => malicious) });
      await expect(OfficialDailyPracticePage(input())).rejects.toThrow(/incompatible/i);
    }
    expect(mocked.dailyGame).not.toHaveBeenCalled();
  });

  it('renders the shared Daily game with edition transport mode and a permanent exact-ID practice link', async () => {
    enable();
    const page = await OfficialDailyPracticePage(input());
    const html = renderToStaticMarkup(page);
    expect(html).toContain('Practice — scores are not submitted');
    expect(html).toContain('shared-daily-game');
    expect(html).toContain('href="/archive"');
    expect(html).toContain('href="/"');
    expect(html).not.toContain('href="/daily/editions"');
    expect(html).not.toContain('PRIVATE_FUTURE_HINT');
    expect(mocked.createRuntime).toHaveBeenCalledWith(ID);
    expect(mocked.createRuntime.mock.results[0]?.value.getBootstrap).toHaveBeenCalledWith(DATE);
    expect(mocked.dailyGame).toHaveBeenCalledWith(expect.objectContaining({
      officialEditionPractice: true, archivePath: URL, initialProgressionToken: 'signed-token',
      puzzle: expect.objectContaining({ id: ID }),
    }));
  });
  it('offers the edition chooser only when its independent release flags permit it', async () => {
    enable();
    vi.mocked(isOfficialDailyEditionChooserVisible).mockReturnValue(true);
    const html = renderToStaticMarkup(await OfficialDailyPracticePage(input()));
    expect(html).toContain('href="/daily/editions"');
    expect(html).toContain('More official Daily puzzles');
    expect(html).toContain('href="/archive"');
    expect(html).not.toContain('PRIVATE_FUTURE_HINT');
    expect(mocked.createRuntime).toHaveBeenCalledOnce();
  });
});

describe('published edition links open their exact practice route', () => {
  it('keeps two same-day editions and an older Archive edition distinct', async () => {
    enable();
    vi.mocked(isOfficialDailyEditionChooserVisible).mockReturnValue(true);
    const secondId = 'daily-ed-v1-2a65c93c-3f36-4f4b-853f-92e85bb81648';
    const olderId = 'daily-ed-v1-269b64cf-1242-4775-a2e3-04b999ae088e';
    const olderDate = '2026-11-04';
    mocked.readChoice.mockResolvedValueOnce({
      puzzleDate: DATE, nextCursor: null,
      editions: [ID, secondId].map((puzzleId, index) => ({
        puzzleId, puzzleDate: DATE, editionNumber: index + 2,
        title: 'Edition ' + (index + 2), editionKey: 'edition-' + (index + 2),
        puzzleNumber: 194,
      })),
    });
    const choiceHtml = renderToStaticMarkup(await ChoicePage({ searchParams: Promise.resolve({}) }));
    const archiveHtml = renderToStaticMarkup(<UnifiedOfficialDailyArchiveSection page={{
      nextCursor: null, dates: [{ puzzleDate: olderDate, editions: [
        { kind: 'legacy-primary', puzzleId: null, puzzleDate: olderDate,
          editionNumber: 1, title: 'Puzzle 1', puzzleNumber: 192 },
        { kind: 'official-secondary', puzzleId: olderId, puzzleDate: olderDate,
          editionNumber: 2, title: 'Retro', puzzleNumber: 192 },
      ] }],
    }} />);
    const links = (html: string) => Array.from(
      html.matchAll(/href="(\/daily\/editions\/[^"]+)"/g), match => match[1]!,
    );
    const chooserLinks = links(choiceHtml);
    const archiveLinks = links(archiveHtml);
    expect(chooserLinks).toHaveLength(2);
    expect(archiveLinks).toHaveLength(1);
    const published = new Map([[ID, DATE], [secondId, DATE], [olderId, olderDate]]);
    mocked.createRuntime.mockImplementation((puzzleId: string) => ({
      getBootstrap: async (date: string) => {
        if (published.get(puzzleId) !== date) throw new Error('Incorrect publication identity');
        return safeBootstrap(puzzleId, date);
      },
    }));
    for (const href of [...chooserLinks, ...archiveLinks]) {
      const url = new globalThis.URL(href, 'https://fixture.invalid');
      const puzzleId = url.pathname.split('/').at(-1)!;
      const query = Object.fromEntries(url.searchParams);
      const html = renderToStaticMarkup(await OfficialDailyPracticePage(input(puzzleId, query)));
      expect(html).toContain('Practice — scores are not submitted');
      expect(mocked.dailyGame).toHaveBeenLastCalledWith(expect.objectContaining({
        archivePath: href, officialEditionPractice: true,
        puzzle: expect.objectContaining({ id: puzzleId, puzzleDate: query.date }),
      }));
    }
    expect(mocked.createRuntime.mock.calls).toEqual([[ID], [secondId], [olderId]]);
  });
});
