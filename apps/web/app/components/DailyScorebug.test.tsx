import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_DAILY_SCORE_SUMMARY } from '@initial-baseball/shared';
import { DailyScorebug } from './DailyScorebug';

(globalThis as Record<string, unknown>).React = React;

describe('DailyScorebug points presentation', () => {
  it('shows the current total without a denominator and the live at-bat allowance', () => {
    const html = renderToStaticMarkup(React.createElement(DailyScorebug, {
      currentAtBat: 3,
      totalAtBats: 9,
      rulesetVersion: 'points-v3',
      summary: DEFAULT_DAILY_SCORE_SUMMARY,
      points: {
        points: 12,
        maximumPoints: 63,
        atBatsCompleted: 2,
        totalAtBats: 9,
        completed: false,
      },
      atBatPointsRemaining: 5,
      bases: { first: false, second: false, third: false },
    }));

    expect(html).toContain('>Points<');
    expect(html).toContain('>12<');
    expect(html).not.toContain('12/63');
    expect(html).toContain('>This AB<');
    expect(html).toContain('>5<');
  });

  it('does not add the live allowance to compatibility points modes', () => {
    const html = renderToStaticMarkup(React.createElement(DailyScorebug, {
      currentAtBat: 3,
      totalAtBats: 9,
      rulesetVersion: 'points-v2',
      summary: DEFAULT_DAILY_SCORE_SUMMARY,
      points: {
        points: 4.5,
        maximumPoints: 36,
        atBatsCompleted: 2,
        totalAtBats: 9,
        completed: false,
      },
      bases: { first: false, second: false, third: false },
    }));

    expect(html).toContain('>4.5<');
    expect(html).not.toContain('4.5/36');
    expect(html).not.toContain('This AB');
  });
});
