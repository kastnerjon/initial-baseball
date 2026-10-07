import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DailyNineDetailedScoreboard, DailyNineDetailedScoreboardTable } from './DailyNineDetailedScoreboard';

(globalThis as Record<string, unknown>).React = React;

const rows = [
  { pitchNumber: 1, initials: 'BH', outcome: 'HR' as const, score: '4', average: '2.8' },
  { pitchNumber: 2, initials: 'DS', outcome: 'K' as const, score: '0', average: '0.4' },
];

const comparisons = {
  1: {
    status: 'success' as const,
    resolvedAtBatCount: 1,
    averagePoints: 1,
    rulesetVersion: 'points-v4' as const,
    scoreHistogram: [0, 0, 1, 0, 0, 0, 0, 0, 0],
  },
  2: { status: 'unavailable' as const },
};

const props = {
  rows,
  answers: { 1: 'Bryce Harper', 2: 'Dave Stieb', 3: 'Unresolved Player' },
  points: { 1: 4, 2: 0 },
  comparisons,
  totalPoints: 4,
  completedComparison: {
    status: 'success' as const,
    ownPoints: 4,
    completedGameCount: 1,
    averageTotalPoints: 6,
    strictLowerFinishRate: 0,
  },
};

describe('DailyNineDetailedScoreboard', () => {
  it('keeps answered names out of the default scoreboard markup and retains exact row outcomes', () => {
    const html = renderToStaticMarkup(<DailyNineDetailedScoreboard {...props} compact={false} />);
    expect(html).toContain('daily-nine-detail-card');
    expect(html).toContain('daily-nine-detail-header');
    expect(html).toContain('Reveal answers');
    expect(html).toContain('role="switch"');
    expect(html).not.toContain('checked=""');
    expect(html).not.toContain('Bryce Harper');
    expect(html).not.toContain('Dave Stieb');
    expect(html).not.toContain('Unresolved Player');
    expect(html).toContain('HR - 4');
    expect(html).toContain('K - 0');
    expect(html).toContain('>BEAT %<');
    expect(html).toContain('>100%</td>');
    expect(html).toContain('>0%</td>');
    expect(html).toContain('>TOTAL</span>');
    expect(html).toMatch(/colspan="2"/i);
    expect(html).toContain('>6.0</td>');
  });

  it('shows only previously resolved names when Reveal answers is on', () => {
    const html = renderToStaticMarkup(<DailyNineDetailedScoreboardTable {...props} revealAnswers />);
    expect(html).toContain('BH:</strong><span class="daily-nine-detail-answer">Bryce Harper');
    expect(html).toContain('DS:</strong><span class="daily-nine-detail-answer">Dave Stieb');
    expect(html).not.toContain('Unresolved Player');
  });

  it('uses pregame completed AVG but never fabricates a total BEAT ranking for unfinished scores', () => {
    const html = renderToStaticMarkup(<DailyNineDetailedScoreboardTable
      {...props}
      revealAnswers={false}
      totalPoints={4}
      completedComparison={{
        status: 'success', ownPoints: null, completedGameCount: 1,
        averageTotalPoints: 6, strictLowerFinishRate: null,
      }}
    />);
    const total = html.slice(html.indexOf('>TOTAL</span>'));
    expect(total).toContain('>4</td>');
    expect(total).toContain('>6.0</td>');
    expect(total).toContain('>—</td>');
    expect(total).not.toContain('>0%</td>');
  });

  it('preserves compact during-play disclosure and scrollable keyboard-accessible table', () => {
    const html = renderToStaticMarkup(<DailyNineDetailedScoreboard {...props} compact />);
    expect(html).toContain('<details class="pitch-results-card pitch-results-card-compact daily-nine-detail-card daily-nine-detail-card-compact">');
    expect(html).toContain('daily-nine-detail-summary');
    expect(html).toContain('>Scoreboard</span>');
    expect(html).not.toContain('1 completed</span>');
    expect(html).toContain('aria-label="Detailed scores by at-bat" tabindex="0"');
  });

  it('displays a dash for absent archived peer histograms rather than guessing BEAT', () => {
    const html = renderToStaticMarkup(<DailyNineDetailedScoreboardTable
      {...props}
      revealAnswers={false}
      comparisons={{ 1: { status: 'success', resolvedAtBatCount: 1, averagePoints: 2 } }}
      completedComparison={{ status: 'unavailable', ownPoints: 4 }}
    />);
    expect(html).toContain('>—</td>');
    expect(html).toContain('Completed-game BEAT');
  });
});
