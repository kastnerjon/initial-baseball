import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DailyShareResult } from '@initial-baseball/shared';
import { GameCompleteView } from './GameCompleteView';

(globalThis as Record<string, unknown>).React = React;

const shareText = [
  'Daily Nine #146',
  'by Initial Baseball',
  '',
  '41/63 PTS · 2 K',
  '',
  'JR: HR',
  '',
  'https://example.test/',
].join('\n');

const shareResult: DailyShareResult = {
  rulesetVersion: 'points-v3',
  summary: { runs: 5, hits: 7, outs: 2, strikeouts: 2, completed: true },
  points: { points: 41, maximumPoints: 63, atBatsCompleted: 9, totalAtBats: 9, completed: true },
  puzzleNumber: 146,
  pitchLines: [{ initials: 'JR', outcome: 'HR' }],
  url: 'https://example.test/',
};

describe('GameCompleteView comparison', () => {
  it('shows personal points without baseball-summary residue while comparison loads', () => {
    const html = render({ status: 'loading', ownPoints: 41 });

    expect(html).toContain('41 PTS');
    expect(html).not.toContain('41/63 PTS');
    expect(html).not.toContain('9/9 AB');
    expect(html).not.toContain('2 K');
    expect(html).not.toContain('>YOU<');
    expect(html).toContain('Loading comparison…');
    expect(html).toContain('Share');
  });

  it('shows completed-game AVG and strict-lower BEAT with one other result', () => {
    const html = render({
      status: 'success',
      ownPoints: 41,
      completedGameCount: 1,
      averageTotalPoints: 35,
      strictLowerFinishRate: 1,
    });

    expect(html).toContain('41 PTS');
    expect(html).toContain('AVG 35.0');
    expect(html).toContain('BEAT 100%');
    expect(html).toContain('Above AVG');
    expect(html).toContain('completed-comparison-performance-above');
    expect(html).toContain("1 other completed result · ties aren&#x27;t counted as beaten");
  });

  it('renders AVG ties as red/not-above while strict-lower BEAT remains zero', () => {
    const html = render({
      status: 'success',
      ownPoints: 35,
      completedGameCount: 1,
      averageTotalPoints: 35,
      strictLowerFinishRate: 0,
    });

    expect(html).toContain('AVG 35.0');
    expect(html).toContain('BEAT 0%');
    expect(html).toContain('At or below AVG');
    expect(html).toContain('completed-comparison-performance-at-or-below');
  });

  it('shows the revealed player name in the in-app Daily Nine scorecard without adding it to share text', () => {
    const html = render(
      { status: 'loading', ownPoints: 41 },
      { 1: 'Jackie Robinson' },
    );

    expect(html).toContain('Player');
    expect(html).toContain('Jackie Robinson');
    expect(html).toContain('JR');
    expect(html).not.toContain('JR: Jackie Robinson');
  });

  it('renders the completed inning scoreboard between the summary and detailed scorecard', () => {
    const html = renderToStaticMarkup(
      <GameCompleteView
        shareResult={shareResult}
        shareText={shareText}
        comparison={{ status: 'loading', ownPoints: 41 }}
        inningScoreboard={{
          columns: [{
            atBatNumber: 1,
            initials: 'JR',
            current: false,
            user: { display: '4', accessibleLabel: 'Your score for at-bat 1: 4' },
            average: { display: '3.5', accessibleLabel: 'At-bat 1 average: 3.5' },
          }],
          totalUser: { display: '41', accessibleLabel: 'Your total score: 41' },
          totalAverage: { display: '—', accessibleLabel: 'Completed-game average is loading' },
        }}
      />,
    );

    expect(html).toContain('Daily Nine scoreboard');
    expect(html.indexOf('Daily Nine scoreboard')).toBeLessThan(html.indexOf('At-bat Results'));
    expect(html).not.toContain('aria-current="step"');
  });

  it('degrades comparison failure without removing personal points', () => {
    const html = render({ status: 'unavailable', ownPoints: 41 });

    expect(html).toContain('Comparison unavailable');
    expect(html).toContain('41 PTS');
    expect(html).not.toContain('41/63 PTS');
    expect(html).not.toContain('2 K');
    expect(html).toContain('At-bat Results');
  });
});

function render(
  comparison: NonNullable<Parameters<typeof GameCompleteView>[0]['comparison']>,
  scorecardAnswers: NonNullable<Parameters<typeof GameCompleteView>[0]['scorecardAnswers']> = {},
): string {
  return renderToStaticMarkup(
    <GameCompleteView
      shareResult={shareResult}
      shareText={shareText}
      comparison={comparison}
      scorecardAnswers={scorecardAnswers}
    />,
  );
}
