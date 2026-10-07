import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createDailyNineInningScoreboardPresentation } from '../dailyNineInningScoreboardPresentation';
import { InningScoreboard } from './InningScoreboard';

(globalThis as Record<string, unknown>).React = React;

const pitches = [
  { pitchNumber: 1, initials: 'KGJ' },
  { pitchNumber: 2, initials: 'DO' },
  { pitchNumber: 3, initials: 'PM' },
  { pitchNumber: 4, initials: 'DW' },
  { pitchNumber: 5, initials: 'CS' },
  { pitchNumber: 6, initials: 'AR' },
  { pitchNumber: 7, initials: 'CC' },
  { pitchNumber: 8, initials: 'MO' },
  { pitchNumber: 9, initials: 'JR' },
];

describe('Daily Nine inning scoreboard presentation', () => {
  it('keeps unresolved cells stable and formats completed half-points cleanly', () => {
    const presentation = createDailyNineInningScoreboardPresentation({
      pitches,
      currentPitchNumber: 3,
      rulesetVersion: 'points-v4',
      atBatPoints: { 1: 4, 2: 0.5 },
      atBatComparisons: {
        1: { status: 'success', resolvedAtBatCount: 12, averagePoints: 2.25 },
        2: { status: 'loading' },
      },
      totalPoints: 4.5,
      completedComparison: { status: 'idle' },
    });

    expect(presentation.columns[0]?.user.display).toBe('4');
    expect(presentation.columns[0]?.average.display).toBe('2.3');
    expect(presentation.columns[1]?.user.display).toBe('0.5');
    expect(presentation.columns[1]?.average.display).toBe('…');
    expect(presentation.columns[2]?.current).toBe(true);
    expect(presentation.columns[2]?.user.display).toBe('—');
    expect(presentation.columns[2]?.average.display).toBe('…');
    expect(presentation.columns[2]?.average.accessibleLabel).toContain('is loading');
    expect(presentation.totalUser.display).toBe('4.5');
    expect(presentation.totalAverage.display).toBe('…');
    expect(presentation.totalAverage.accessibleLabel).toContain('is loading');
  });

  it('uses the cached current-slot comparison for a resolved at-bat and completed games for TOTAL AVG', () => {
    const presentation = createDailyNineInningScoreboardPresentation({
      pitches,
      currentPitchNumber: 9,
      rulesetVersion: 'points-v4',
      atBatPoints: { 1: 4, 2: 0.5, 9: 2 },
      atBatComparisons: {
        1: { status: 'success', resolvedAtBatCount: 12, averagePoints: 2.25 },
        9: { status: 'success', resolvedAtBatCount: 4, averagePoints: 1.75 },
      },
      totalPoints: 18.5,
      completedComparison: {
        status: 'success',
        ownPoints: 18.5,
        completedGameCount: 20,
        averageTotalPoints: 17.25,
        strictLowerFinishRate: 0.5,
      },
    });

    expect(presentation.columns[8]?.user.display).toBe('2');
    expect(presentation.columns[8]?.average.display).toBe('1.8');
    expect(presentation.totalUser.display).toBe('18.5');
    expect(presentation.totalAverage.display).toBe('17.3');
    expect(presentation.totalAverage.accessibleLabel).toContain('20 other completed results');
  });

  it('has no current-at-bat marker once the game is complete', () => {
    const presentation = createDailyNineInningScoreboardPresentation({
      pitches,
      currentPitchNumber: null,
      rulesetVersion: 'points-v4',
      atBatPoints: Object.fromEntries(pitches.map(pitch => [pitch.pitchNumber, 1])),
      atBatComparisons: {},
      totalPoints: 9,
      completedComparison: { status: 'loading', ownPoints: 9 },
    });

    expect(presentation.columns.every(column => !column.current)).toBe(true);
  });

  it('renders a semantic table with a visible and accessible current-at-bat marker', () => {
    const presentation = createDailyNineInningScoreboardPresentation({
      pitches,
      currentPitchNumber: 3,
      rulesetVersion: 'points-v4',
      atBatPoints: { 1: 4, 2: 0.5 },
      atBatComparisons: {},
      totalPoints: 4.5,
      completedComparison: { status: 'idle' },
    });

    const html = renderToStaticMarkup(React.createElement(InningScoreboard, presentation));

    expect(html).toContain('<table class="inning-scoreboard">');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('NOW');
    expect(html).toContain('At bat 3, initials PM, current at-bat');
    expect(html).toContain('>YOU<');
    expect(html).toContain('>AVG<');
    expect(html).toContain('>TOTAL<');
    expect(html).not.toContain('Points possible');
    expect(html).not.toContain('Strikeouts');
  });
});
