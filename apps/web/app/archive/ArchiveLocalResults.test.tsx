import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ArchiveLocalResultsList } from './ArchiveLocalResults';
import type { BrowserCompletedGame, BrowserCompletedGameHistory } from '../browserCompletedGameHistory';

const archive: BrowserCompletedGame = {
  key: 'opaque-storage-key', puzzleId: 'archive-beta-v1-daily-4',
  puzzleDate: '2026-10-20', puzzleNumber: 4,
  mode: 'Archive', rulesetVersion: 'points-v3', submissionStatus: 'submitted',
  score: 63, maximum: 63, totalAtBats: 9, atBats: [],
};
const puzzles = [
  { dailyNumber: 4, puzzleDate: '2026-10-20' },
  { dailyNumber: 5, puzzleDate: '2026-10-21' },
];
function render(history: BrowserCompletedGameHistory | null, savedProgress: ReadonlySet<string> = new Set()) {
  return renderToStaticMarkup(<ArchiveLocalResultsList
    puzzles={puzzles} history={history} savedProgress={savedProgress} />);
}

describe('Archive read-only browser results status', () => {
  it('displays the actual saved versioned score and links to only that archive identity', () => {
    const html = render({ status: 'ready', games: [archive], unreadableRecords: 0 });
    expect(html).toContain('63 / 63');
    expect(html).toContain('points-v3');
    expect(html).toContain('/results?archivePuzzleId=archive-beta-v1-daily-4');
    expect(html).toContain('Play / resume');
    expect(html).not.toContain('opaque-storage-key');
    expect(html).not.toContain('0 / 36');
  });

  it('never treats same-date Daily, Classic or another archive identity as this puzzle', () => {
    const unrelated = [
      { ...archive, mode: 'Daily' as const, key: 'daily', score: 12 },
      { ...archive, mode: 'Classic' as const, key: 'classic', score: 9 },
      { ...archive, puzzleId: 'archive-beta-v1-daily-5', key: 'other', score: 8 },
      { ...archive, puzzleDate: '2026-10-19', key: 'different-date', score: 5 },
    ];
    const html = render({ status: 'ready', games: unrelated, unreadableRecords: 0 });
    expect(html).not.toContain('View at-bat details');
    expect(html).not.toContain('12 /');
    expect(html).toContain('Play / resume');
  });

  it('does not confuse multiple historical rulesets or local-only pending status', () => {
    const second = { ...archive, key: 'other-version', rulesetVersion: 'points-v4',
      score: 36, maximum: 36, submissionStatus: 'pending' as const };
    const html = render({ status: 'ready', games: [archive, second], unreadableRecords: 0 });
    expect(html).toContain('63 / 63');
    expect(html).toContain('36 / 36');
    expect(html).toContain('submission not confirmed');
  });

  it('is safe when storage has no completion, is loading, or is unavailable', () => {
    const unavailable: BrowserCompletedGameHistory = { status: 'unavailable' };
    const empty: BrowserCompletedGameHistory = { status: 'ready', games: [], unreadableRecords: 1 };
    for (const history of [null, unavailable, empty]) {
      const html = render(history);
      expect(html).toContain('Archive beta #4');
      expect(html).toContain('Play / resume');
      expect(html).not.toContain('Saved here');
      expect(html).not.toContain('0 /');
    }
  });
  it('shows advisory saved progress only for a matching issued Archive row', () => {
    const html = render({ status: 'ready', games: [], unreadableRecords: 0 },
      new Set(['archive-beta-v1-daily-4']));
    expect(html).toContain('Saved local progress · Resume');
    expect(html).toContain('Archive beta #5');
    expect(html).not.toContain('0 /');
    expect(html).not.toContain('View at-bat details');
  });

  it('prioritizes decoded completed results over a simultaneous old gameplay save', () => {
    const html = render({ status: 'ready', games: [archive], unreadableRecords: 0 },
      new Set(['archive-beta-v1-daily-4']));
    expect(html).toContain('63 / 63');
    expect(html).toContain('View at-bat details');
    expect(html).not.toContain('Saved local progress · Resume');
  });
});
