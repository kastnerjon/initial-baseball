import { describe, expect, it } from 'vitest';
import {
  CLASSIC_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';
import { getDailyHowToContent } from './dailyHowTo';

describe('Daily How to play content', () => {
  it('describes the currently live points-v3 deduction rules exactly', () => {
    const content = getDailyHowToContent(POINTS_V3_DAILY_RULESET_VERSION);
    const text = [content.intro, ...content.steps, content.footer].join(' ');

    expect(content.title).toBe('How to play Daily Nine');
    expect(text).toContain('starts at 7 points');
    expect(text).toContain('Every revealed hint and every wrong guess costs 1 point');
    expect(text).toContain('third wrong guess—or Give Up—scores 0 points');
    expect(text).toContain('maximum score of 63');
    expect(text).not.toContain('0.5');
    expect(content.scoringRows).toBeUndefined();
    expect(content.strikes).toBeUndefined();
  });

  it('explains current points-v4 scoring with baseball outcomes and strikes', () => {
    const content = getDailyHowToContent(POINTS_V4_DAILY_RULESET_VERSION);

    expect(content.title).toBe('How to play Daily Nine');
    expect(content.intro).toBe('Guess 9 baseball players using their initials and up to 4 hints.');
    expect(content.lead).toBe('The fewer hints you use, the more points you score.');
    expect(content.steps).toEqual([]);
    expect(content.scoringRows).toEqual([
      { when: 'No hints', result: 'Home Run (HR)', points: '4' },
      { when: 'After 1 hint', result: 'Triple (3B)', points: '3' },
      { when: 'After 2 hints', result: 'Double (2B)', points: '2' },
      { when: 'After 3 hints', result: 'Single (1B)', points: '1' },
      { when: 'After 4 hints', result: 'Walk (BB)', points: '0.5' },
    ]);
    expect(content.strikes).toEqual({
      heading: 'What happens if you strike out?',
      rules: [
        'Each incorrect guess counts as a strike.',
        "Your first 2 strikes don't reduce your points.",
        'Strike 3 ends the at-bat with 0 points.',
        'You can give up at any time for 0 points.',
      ],
    });
    expect(content.footerLabel).toBe('Your goal:');
    expect(content.footer).toBe('Score as many points as possible across 9 at-bats. A perfect game is 36 points!');
  });

  it('keeps Classic instructions baseball-native and three-out bounded', () => {
    const content = getDailyHowToContent(CLASSIC_DAILY_RULESET_VERSION);
    const text = [content.intro, ...content.steps, content.footer].join(' ');

    expect(content.title).toBe('How to play Classic Inning');
    expect(text).toContain('records an out');
    expect(text).toContain('Hits and walks move runners');
    expect(text).toContain('ends after 3 outs or after the ninth at-bat');
    expect(text).not.toContain('points');
    expect(content.scoringRows).toBeUndefined();
    expect(content.strikes).toBeUndefined();
  });
});
