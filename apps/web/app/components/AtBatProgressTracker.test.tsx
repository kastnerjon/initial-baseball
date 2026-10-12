import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AtBatProgressTracker } from './AtBatProgressTracker';

const render = (currentAtBat: number, completedAtBats: number[]) =>
  renderToStaticMarkup(<AtBatProgressTracker currentAtBat={currentAtBat}
    completedAtBats={completedAtBats} />);

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
    expect(html.match(/âœ“/g)).toHaveLength(4);
  });
  it('handles a just-resolved batter without falsely advancing current at-bat', () => {
    const html = render(5, [1, 2, 3, 4, 5]);
    expect(html).toContain('At-bat 5: compl¶»§q«^