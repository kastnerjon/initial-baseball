import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AtBatProgressTracker } from './AtBatProgressTracker';

const render = (currentAtBat: number, completedAtBats: number[], score = 0) =>
  renderToStaticMarkup(<AtBatProgressTracker currentAtBat={currentAtBat}
    completedAtBats={completedAtBats} score={score} />);

describe('AtBatProgressTracker', () => {
  it('shows all nine numbered stages and the first current position at startup', () => {
    const html = render(1, []);
    expect(html).toContain('AT-BAT 1 OF 9');
    expect(html).toContain('aria-label="At-bat 1: current"');
    expect(html).toContain('aria-label="At-bat 9: upcoming"');
    expect(html).not.toContain('At-bat 0:');
    expect(html.match(/at-bat-progress-step--/g)).toHaveLength(9);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
  });
  it('shows checks for completed stages, the current numbered circle, and future outlines', () => {
    const html = render(5, [1, 2, 3, 4]);
    expect(html).toContain('AT-BAT 5 OF 9');
    expect(html).toContain('aria-label="At-bat 4: completed"');
    expect(html).toContain('aria-label="At-bat 5: current"');
    expect(html).toContain('aria-label="At-bat 6: upcoming"');
    expect(html.match(/✓/g)).toHaveLength(4);
  });
  it('handles a just-resolved batter without falsely advancing current at-bat', () => {
    const html = render(5, [1, 2, 3, 4, 5]);
    expect(html).toContain('At-bat 5: completed');
    expect(html).toContain('AT-BAT 5 OF 9');
    expect(html).not.toContain('At-bat 6: current');
  });
  it('has a completed state for all nine', () => {
    const html = render(9, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(html).toContain('ALL 9 AT-BATS COMPLETE');
    expect(html.match(/aria-current="step"/g)).toBeNull();
  });
  it('renders the cumulative score left and the at-bat number right in one row', () => {
    const html = render(4, [1, 2, 3], 240);
    expect(html).toMatch(/class="at-bat-progress-meta"[^>]*><span class="at-bat-progress-score">SCORE: 240<\/span><span class="at-bat-progress-caption">AT-BAT 4 OF 9<\/span><\/div>/);
    expect(html.match(/SCORE:/g)).toHaveLength(1);
  });
  it('formats zero, negative and large cumulative scores without doing scoring', () => {
    expect(render(1, [], 0)).toContain('SCORE: 0');
    expect(render(5, [1, 2, 3, 4], -1)).toContain('SCORE: -1');
    expect(render(5, [1, 2, 3, 4], 0.5)).toContain('SCORE: 0.5');
    expect(render(5, [1, 2, 3, 4], 1.5)).toContain('SCORE: 1.5');
    expect(render(9, [1, 2, 3, 4, 5, 6, 7, 8], 12345)).toContain('SCORE: 12,345');
    expect(() => render(2, [1], Number.NaN)).toThrow('Invalid at-bat tracker score');
    expect(() => render(2, [1], Number.POSITIVE_INFINITY)).toThrow('Invalid at-bat tracker score');
  });

  it('rejects invalid or contradictory stage data', () => {
    expect(() => render(0, [])).toThrow();
    expect(() => render(5, [1, 1])).toThrow();
    expect(() => render(4, [1, 5])).toThrow();
  });
});
