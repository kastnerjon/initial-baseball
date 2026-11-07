import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UnifiedOfficialDailyArchiveSection } from './UnifiedOfficialDailyArchiveSection';
import type { UnifiedArchivePage } from '../unifiedOfficialDailyArchiveMerge';

const records: UnifiedArchivePage['dates'] = [
  { puzzleDate: '2026-11-05', editions: [
    { kind: 'legacy-primary', puzzleDate: '2026-11-05', puzzleNumber: 193,
      editionNumber: 1, title: 'Puzzle 1', puzzleId: null },
    { kind: 'official-secondary', puzzleDate: '2026-11-05', puzzleNumber: 193,
      editionNumber: 2, title: 'Modern', puzzleId: 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08' },
    { kind: 'official-secondary', puzzleDate: '2026-11-05', puzzleNumber: 193,
      editionNumber: 3, title: '70s/80s/90s', puzzleId: 'daily-ed-v1-6077ee21-9370-4cf3-aa21-74c50b485591' },
  ] },
  { puzzleDate: '2026-11-04', editions: [
    { kind: 'legacy-primary', puzzleDate: '2026-11-04', puzzleNumber: 192,
      editionNumber: 1, title: 'Puzzle 1', puzzleId: null },
    { kind: 'official-secondary', puzzleDate: '2026-11-04', puzzleNumber: 192,
      editionNumber: 2, title: 'Puzzle 2', puzzleId: 'daily-ed-v1-269b64cf-1242-4775-a2e3-04b999ae088e' },
  ] },
];

describe('one date-grouped historical official Archive presentation', () => {
  it('lists the actual primary and all same-day secondary occurrences in order', () => {
    const html = renderToStaticMarkup(<UnifiedOfficialDailyArchiveSection page={{
      dates: records, nextCursor: { puzzleDate: '2026-11-04', editionNumber: 2 },
    }} />);
    expect(html).toContain('Official Daily editions');
    expect(html).toContain('2026-11-05 – Puzzle 1');
    expect(html).toContain('2026-11-05 – Modern');
    expect(html).toContain('2026-11-05 – 70s/80s/90s');
    expect(html).toContain('2026-11-04 – Puzzle 1');
    expect(html).toContain('2026-11-04 – Puzzle 2');
    expect((html.match(/<h3>/g) ?? []).length).toBe(2);
    expect((html.match(/Historical replay unavailable/g) ?? []).length).toBe(2);
    expect(html).toContain('/archive?afterDate=2026-11-04&amp;afterEdition=2');
  });

  it('never creates a playable link from the editorial primary ID or its null identity', () => {
    const html = renderToStaticMarkup(<UnifiedOfficialDailyArchiveSection page={{
      dates: records, nextCursor: null,
    }} />);
    expect(html).not.toContain('daily-2026-11-05-v1');
    expect(html).not.toContain('href="/daily/2026-11-05"');
    expect(html).not.toContain('daily/editions/null');
    expect(html).not.toContain('/daily/editions/daily-2026');
    expect((html.match(/<a /g) ?? []).length).toBe(3);
    expect(html).toContain('/daily/editions/daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08?date=2026-11-05');
    expect(html).toContain('/daily/editions/daily-ed-v1-6077ee21-9370-4cf3-aa21-74c50b485591?date=2026-11-05');
    expect(html).toContain(' · Practice');
  });

  it('supports a partial date page, an empty page, and the end-of-list cursor', () => {
    const partial = renderToStaticMarkup(<UnifiedOfficialDailyArchiveSection page={{
      dates: [{ puzzleDate: records[0]!.puzzleDate,
        editions: records[0]!.editions.slice(1, 2) }],
      nextCursor: { puzzleDate: '2026-11-05', editionNumber: 2 },
    }} />);
    expect(partial).toContain('Modern');
    expect(partial).not.toContain('Historical replay unavailable');
    expect(partial).toContain('/archive?afterDate=2026-11-05&amp;afterEdition=2');
    const empty = renderToStaticMarkup(<UnifiedOfficialDailyArchiveSection page={{
      dates: [], nextCursor: null,
    }} />);
    expect(empty).toContain('No earlier official editions have been issued yet.');
    expect(empty).not.toContain('Older official editions');
  });

  it('escapes editor-provided titles and does not emit hidden answers or scored comparisons', () => {
    const html = renderToStaticMarkup(<UnifiedOfficialDailyArchiveSection page={{
      dates: [{ puzzleDate: '2026-11-05', editions: [{
        kind: 'official-secondary', puzzleDate: '2026-11-05', puzzleNumber: 193,
        editionNumber: 2, title: '<img src=x onerror=alert(1)>',
        puzzleId: 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08',
      }] }],
      nextCursor: null,
    }} />);
    expect(html).not.toContain('<img ');
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('clue_snapshot');
    expect(html).not.toContain('canonicalPlayerIds');
    expect(html).not.toContain('Leaderboard');
    expect(html).not.toContain('AVG');
  });
});
