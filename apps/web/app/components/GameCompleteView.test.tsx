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

  it('puts completed-game AVG beside personal points when displayable', () => {
    const waiting = render({
      status: 'success',
      ownPoints: 41,
      completedGameCount: 1,
      averageTotalPoints: 35,
      strictLowerFinishRate: 0,
    });
    const early = render({
      status: 'success',
      ownPoints: 41,
      completedGameCount: 7,
      averageTotalPoints: 34.26,
      strictLowerFinishRate: 0.5,
    });

    expect(waiting).toContain('41 PTS');
    expect(waiting).not.toContain('AVG 35.0');
    expect(waiting).toContain('Waiting for more completed results · 1 result');

    expect(early).toContain('41 PTS');
    expect(early).toContain('AVG 34.3');
    expect(early).toContain('Early average · 7 completed results');
    expect(early).not.toContain('Early AVG 34.3');
  });

  it('waits until 20 completions before showing strict-lower BEAT', () => {
    const nineteen = render({
      status: 'success',
      ownPoints: 41,
      completedGameCount: 19,
      averageTotalPoints: 33.5,
      strictLowerFinishRate: 0.63,
    });
    const twenty = render({
      status: 'success',
      ownPoints: 41,
      completedGameCount: 20,
      averageTotalPoints: 33.5,
      strictLowerFinishRate: 0.63,
    });

    expect(nineteen).toContain('41 PTS');
    expect(nineteen).toContain('AVG 33.5');
    expect(nineteen).toContain('BEAT appears at 20');
    expect(nineteen).not.toContain('63%');

    expect(twenty).toContain('41 PTS');
    expect(twenty).toContain('AVG 33.5');
    expect(twenty).toContain('BEAT 63%');
    expect(twenty).toContain("ties aren&#x27;t counted as beaten");
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
