import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  beta: vi.fn(), visible: vi.fn(), archive: vi.fn(),
}));
vi.mock('../serverArchiveBetaRuntime', () => ({
  listAvailableArchiveBetaPuzzles: mocked.beta,
}));
vi.mock('../serverOfficialDailyArchiveSection', () => ({
  isOfficialDailyArchiveVisible: mocked.visible,
}));
vi.mock('../serverUnifiedOfficialDailyArchiveSection', () => ({
  readPrivateUnifiedOfficialDailyArchive: mocked.archive,
}));
vi.mock('./ArchiveLocalResults', () => ({
  ArchiveLocalResults: () => React.createElement('div', { 'data-testid': 'beta-results' }),
}));
import ArchivePage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  mocked.beta.mockResolvedValue([{ dailyNumber: 1, puzzleDate: '2026-10-20' }]);
  mocked.visible.mockReturnValue(false);
  mocked.archive.mockResolvedValue({ dates: [], nextCursor: null });
});

describe('shared Archive route', () => {
  it('keeps the legacy beta page and does not read official metadata while gated off', async () => {
    const html = renderToStaticMarkup(await ArchivePage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('Archive beta');
    expect(html).toContain('Play an earlier lineup');
    expect(html).toContain('beta-results');
    expect(html).not.toContain('Official Daily editions');
    expect(mocked.archive).not.toHaveBeenCalled();
  });

  it('renders official editions in the same Archive without removing beta results', async () => {
    mocked.visible.mockReturnValue(true);
    mocked.archive.mockResolvedValue({ dates: [{
      puzzleDate: '2026-11-05', editions: [
        { kind: 'legacy-primary', puzzleId: null, puzzleDate: '2026-11-05',
          puzzleNumber: 193, editionNumber: 1, title: 'Puzzle 1' },
        { kind: 'official-secondary',
          puzzleId: 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08',
          puzzleDate: '2026-11-05', puzzleNumber: 193, editionNumber: 2,
          title: 'Modern',
        },
      ],
    }], nextCursor: null });
    const html = renderToStaticMarkup(await ArchivePage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('Past Daily lineups');
    expect(html).toContain('2026-11-05 – Puzzle 1');
    expect(html).toContain('Historical replay unavailable');
    expect(html).toContain('2026-11-05 – Modern');
    expect(html).toContain('Practice replay unavailable');
    expect(html).not.toContain('/daily/editions/');
    expect(html).not.toContain('href="/daily/editions/null');
    expect(html).not.toContain('daily-2026-11-05-v1');
    expect(html).toContain('beta-results');
    expect(mocked.archive).toHaveBeenCalledWith({});
  });

  it('ignores unrelated tracking parameters without discarding incomplete cursor validation', async () => {
    mocked.visible.mockReturnValue(true);
    await ArchivePage({ searchParams: Promise.resolve({
      utm_source: 'newsletter', afterDate: '2026-11-05', afterEdition: '2',
    }) });
    expect(mocked.archive).toHaveBeenCalledWith({
      afterDate: '2026-11-05', afterEdition: '2',
    });
    mocked.archive.mockClear();
    await ArchivePage({ searchParams: Promise.resolve({ utm_source: 'newsletter' }) });
    expect(mocked.archive).toHaveBeenCalledWith({});
    mocked.archive.mockClear();
    await ArchivePage({ searchParams: Promise.resolve({
      afterDate: '2026-11-05', utm_source: 'newsletter',
    }) });
    expect(mocked.archive).toHaveBeenCalledWith({ afterDate: '2026-11-05' });
  });

  it('preserves beta results and avoids leaking private provider errors', async () => {
    mocked.visible.mockReturnValue(true);
    mocked.archive.mockRejectedValue(new Error('PRIVATE_SERVICE_ROLE_CREDENTIAL'));
    const html = renderToStaticMarkup(await ArchivePage({
      searchParams: Promise.resolve({ afterEdition: 'invalid' }),
    }));
    expect(html).toContain('The official edition list is temporarily unavailable.');
    expect(html).toContain('beta-results');
    expect(html).not.toContain('PRIVATE_SERVICE_ROLE_CREDENTIAL');
  });
});
