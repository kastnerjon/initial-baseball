import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DailyShareResult } from '@initial-baseball/shared';
import { GameCompleteView } from './GameCompleteView';

(globalThis as Record<string, unknown>).React = React;

const shareResult: DailyShareResult = {
  rulesetVersion: 'points-v3',
  summary: { runs: 5, hits: 7, outs: 2, strikeouts: 2, completed: true },
  points: { points: 41, maximumPoints: 63, atBatsCompleted: 9, totalAtBats: 9, completed: true },
  puzzleNumber: 146,
  pitchLines: [{ initials: 'JR', outcome: 'HR' }],
  url: 'https://example.test/',
};

describe('GameCompleteView comparison', () => {
  it('shows loading without blocking the final score or share surface', () => {
    const html = render({ status: 'loading', ownPoints: 41 });

    expect(html).toContain('41/63 PTS');
    expect(html).toContain('YOU');
    expect(html).toContain('AVG');
    expect(html).toContain('Loading comparison…');
    expect(html).toContain('Share');
  });

  it('withholds tiny-sample averages and labels early averages', () => {
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

    expect(waiting).toContain('Waiting for more completed results · 1 result');
    expect(waiting).not.toContain('35.0');
    expect(early).toContain('34.3');
    expect(early).toContain('Early average · 7 completed results');
    expect(early).not.toContain('BEAT');
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

    expect(nineteen).toContain('BEAT appears at 20');
    expect(nineteen).not.toContain('63%');
    expect(twenty).toContain('BEAT');
    expect(twenty).toContain('63%');
    expect(twenty).toContain("ties aren&#x27;t counted as beaten");
  });

  it('degrades comparison failure without removing final results', () => {
    const html = render({ status: 'unavailable', ownPoints: 41 });

    expect(html).toContain('Comparison unavailable');
    expect(html).toContain('41/63 PTS');
    expect(html).toContain('At-bat Results');
  });
});

function render(
  comparison: NonNullable<Parameters<typeof GameCompleteView>[0]['comparison']>,
): string {
  return renderToStaticMarkup(
    <GameCompleteView
      shareResult={shareResult}
      shareText="Daily Nine #146"
      comparison={comparison}
    />,
  );
}
