import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getDailyHowToContent } from '../dailyHowTo';
import { CLASSIC_DAILY_RULESET_VERSION, POINTS_V3_DAILY_RULESET_VERSION, POINTS_V4_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { DailyHowToDialog } from './DailyHowToDialog';

describe('DailyHowToDialog structure', () => {
  it('renders an accessible native dialog plus persistent reopen and close controls', () => {
    const html = renderToStaticMarkup(
      <DailyHowToDialog content={getDailyHowToContent(POINTS_V3_DAILY_RULESET_VERSION)} />,
    );

    expect(html).toContain('<dialog');
    expect(html).toContain('aria-labelledby=');
    expect(html).toContain('>How to play</button>');
    expect(html).toContain('aria-label="Close How to play"');
    expect(html).toContain('How to play Daily Nine');
    expect(html).toContain('>Got it</button>');
  });

  it('renders the v4 outcome/points table and strike rules accessibly', () => {
    const html = renderToStaticMarkup(
      <DailyHowToDialog content={getDailyHowToContent(POINTS_V4_DAILY_RULESET_VERSION)} />,
    );

    expect(html).toContain('Guess 9 baseball players using their initials');
    expect(html).toContain('<strong>The fewer hints you use, the more points you score.</strong>');
    expect(html).toContain('<table class="daily-how-to-scoring-table">');
    expect(html).toContain('<th scope="col">When you guess correctly</th>');
    expect(html).toContain('<th scope="col">Result</th>');
    expect(html).toContain('<th scope="col">Points</th>');
    for (const label of ['Home Run (HR)', 'Triple (3B)', 'Double (2B)', 'Single (1B)', 'Walk (BB)']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('Strike 3 ends the at-bat with 0 points.');
    expect(html).toContain('A perfect game is 36 points!');
    expect(html).not.toContain('class="daily-how-to-steps"');
  });

  it.each([POINTS_V3_DAILY_RULESET_VERSION, CLASSIC_DAILY_RULESET_VERSION])(
    'preserves the legacy ordered instructions for %s',
    (rulesetVersion) => {
      const html = renderToStaticMarkup(
        <DailyHowToDialog content={getDailyHowToContent(rulesetVersion)} />,
      );
      expect(html).toContain('<ol class="daily-how-to-steps">');
      expect(html).not.toContain('daily-how-to-scoring-table');
      expect(html).not.toContain('daily-how-to-strikes');
    },
  );
});
