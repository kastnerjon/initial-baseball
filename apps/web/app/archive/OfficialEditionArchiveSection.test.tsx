import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OfficialEditionArchiveSection } from './OfficialEditionArchiveSection';
import type { OfficialDailyArchivePage } from '../serverOfficialDailyArchiveSection';

const dates: OfficialDailyArchivePage['dates'] = [
  { puzzleDate: '2026-11-05', editions: [
    { puzzleId: 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08', puzzleDate: '2026-11-05',
      puzzleNumber: 194, editionNumber: 1, editionKey: 'puzzle-1', title: 'Modern' },
    { puzzleId: 'daily-ed-v1-2a65c93c-3f36-4f4b-853f-92e85bb81648', puzzleDate: '2026-11-05',
      puzzleNumber: 194, editionNumber: 2, editionKey: 'puzzle-2', title: '70s/80s/90s' },
  ] },
  { puzzleDate: '2026-11-04', editions: [
    { puzzleId: 'daily-ed-v1-fbc66880-c30b-45ea-94cd-dd04ed1c3618', puzzleDate: '2026-11-04',
      puzzleNumber: 193, editionNumber: 1, editionKey: 'puzzle-1', title: 'Puzzle 1' },
  ] },
];

describe('official Daily date-grouped Archive presentation', () => {
  it('lists distinct identical-date editions by exact ID and stable title with cursor', () => {
    const html = renderToStaticMarkup(<OfficialEditionArchiveSection page={{
      dates, nextCursor: { puzzleDate: '2026-11-04', editionNumber: 1 },
    }} />);
    expect(html).toContain('Official Daily editions');
    expect(html).toContain('Practice scores');
    expect(html).toContain('2026-11-05 – Modern');
    expect(html).toContain('2026-11-05 – 70s/80s/90s');
    expect(html).toContain('2026-11-04 – Puzzle 1');
    expect(html).toContain('/daily/editions/daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08?date=2026-11-05');
    expect(html).toContain('/daily/editions/daily-ed-v1-2a65c93c-3f36-4f4b-853f-92e85bb81648?date=2026-11-05');
    expect(html).toContain('/archive?afterDate=2026-11-04&amp;afterEdition=1');
    expect((html.match(/<h3>/g) ?? []).length).toBe(2);
    expect(html).not.toContain('clue_snapshot');
    expect(html).not.toContain('correctPlayerIds');
  });

  it('renders an empty Archive without a cursor or invented competitive statistics', () => {
    const html = renderToStaticMarkup(<OfficialEditionArchiveSection page={{
      dates: [], nextCursor: null,
    }} />);
    expect(html).toContain('No earlier official editions have been issued yet.');
    expect(html).not.toContain('Older official editions');
    expect(html).not.toContain('Leaderboard');
    expect(html).not.toContain('AVG');
  });

  it('escapes a previously stored unsafe title instead of interpreting HTML', () => {
    const html = renderToStaticMarkup(<OfficialEditionArchiveSection page={{
      dates: [{ puzzleDate: '2026-11-05', editions: [{
        ...dates[0]!.editions[0]!, title: '<img src=x onerror=alert(1)>',
      }] }], nextCursor: null,
    }} />);
    expect(html).not.toContain('<img ');
    expect(html).toContain('&lt;img');
  });
});
