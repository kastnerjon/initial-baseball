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
  });

  it('describes finalized points-v4 half-point scoring without wrong-guess deductions', () => {
    const content = getDailyHowToContent(POINTS_V4_DAILY_RULESET_VERSION);
    const text = [content.intro, ...content.steps, content.footer].join(' ');

    expect(content.title).toBe('How to play Daily Nine');
    expect(text).toContain('4 points');
    expect(text).toContain('3, 2, 1, then 0.5 points');
    expect(text).toContain('Wrong guesses one and two do not reduce your score');
    expect(text).toContain('third wrong guess—or Give Up—is a strikeout and scores 0 points');
    expect(text).toContain('maximum score of 36');
    expect(text).not.toContain('starts at 7 points');
  });

  it('keeps Classic instructions baseball-native and three-out bounded', () => {
    const content = getDailyHowToContent(CLASSIC_DAILY_RULESET_VERSION);
    const text = [content.intro, ...content.steps, content.footer].join(' ');

    expect(content.title).toBe('How to play Classic Inning');
    expect(text).toContain('records an out');
    expect(text).toContain('Hits and walks move runners');
    expect(text).toContain('ends after 3 outs or after the ninth at-bat');
    expect(text).not.toContain('points');
  });
});
