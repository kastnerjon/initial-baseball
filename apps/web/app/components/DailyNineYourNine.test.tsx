import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DailyNineYourNine, DailyNineYourNineRows, type DailyNineYourNineProps } from './DailyNineYourNine';

(globalThis as Record<string, unknown>).React = React;

const props: DailyNineYourNineProps = {
  rows: [
    { pitchNumber: 1, initials: 'BH', outcome: '2B', score: '2', average: '1.3', beat: '50%' },
    { pitchNumber: 2, initials: 'KGJ', outcome: 'HR', score: '4', average: '2.1', beat: '83%' },
    { pitchNumber: 3, initials: 'DS', outcome: 'K', score: '0', average: '0.0', beat: '0%' },
    { pitchNumber: 4, initials: 'DW', outcome: 'BB', score: '0.5', average: '—', beat: '—' },
  ],
  answers: {
    1: 'Bryce Harper',
    2: 'Ken Griffey Jr.',
    3: 'Dave Stieb',
    4: 'Doug Waechter',
    5: 'Future answer must not appear',
  },
  points: { 1: 2, 2: 4, 3: 0, 4: 0.5 },
  totalPoints: 6.5,
  puzzleNumber: 164,
  totalAtBats: 9,
  currentAtBatNumber: 5,
  currentAtBatInitials: 'AR',
};

describe('Daily Nine Your Nine presentation', () => {
  it('shows one compact running score, all completed outcomes and current progress without an old table', () => {
    const html = renderToStaticMarkup(<DailyNineYourNine {...props} />);
    expect(html).toContain('Your Nine');
    expect(html).toContain('DAILY #164');
    expect(html).toContain('6.5');
    expect(html).toContain('4 of 9 completed');
    expect(html).toContain('2B');
    expect(html).toContain('HR');
    expect(html).toContain('K');
    expect(html).toContain('BB');
    expect(html).toContain('AVG 1.3');
    expect(html).toContain('BEAT 50%');
    expect(html).toContain('BEAT 0%');
    expect(html).toContain('BEAT —');
    expect(html).toContain('width:50%');
    expect(html).toContain('width:100%');
    expect(html).toContain('role="switch"');
    expect(html).not.toContain('checked=""');
    expect(html).not.toContain('<table');
    expect(html).not.toContain('daily-nine-detail-card');
    expect(html).toContain('NOW BATTING');
    expect(html).toContain('AR');
    expect(html).toContain('06–09');
  });

  it('never serializes resolved names when the player toggle is off', () => {
    const html = renderToStaticMarkup(<DailyNineYourNine {...props} />);
    expect(html).toContain('Reveal players');
    expect(html).not.toContain('Bryce Harper');
    expect(html).not.toContain('Ken Griffey Jr.');
    expect(html).not.toContain('Future answer must not appear');
  });

  it('reveals only names associated with existing terminal rows, placed beside initials', () => {
    const html = renderToStaticMarkup(<DailyNineYourNineRows {...props} revealPlayers />);
    expect(html).toContain('BH</strong><span class="your-nine-answer-separator"> - </span><span class="your-nine-answer">Bryce Harper');
    expect(html).toContain('KGJ</strong><span class="your-nine-answer-separator"> - </span><span class="your-nine-answer">Ken Griffey Jr.');
    expect(html).toContain('AR');
    expect(html).not.toContain('Future answer must not appear');
  });

  it('retains initials when a legacy saved result lacks an authorized name', () => {
    const html = renderToStaticMarkup(
      <DailyNineYourNineRows {...props} answers={{ 1: 'Bryce Harper' }} revealPlayers />,
    );
    expect(html).toContain('>KGJ</strong>');
    expect(html).not.toContain('Answer unavailable');
  });

  it('renders current batting and upcoming without disclosing future players or preemptively granting points', () => {
    const html = renderToStaticMarkup(
      <DailyNineYourNine {...props} rows={[]} points={{}} totalPoints={0}
        currentAtBatNumber={1} currentAtBatInitials="BH" />,
    );
    expect(html).toContain('0 of 9 completed');
    expect(html).toContain('NOW BATTING');
    expect(html).toContain('02–09');
    expect(html).not.toContain('2B');
    expect(html).not.toContain('Bryce Harper');
    expect(html).not.toContain('KGJ');
  });

  it('shows all nine results at completion without an active or upcoming row', () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({
      pitchNumber: i + 1, initials: 'AA', outcome: 'HR' as const,
      score: '4', average: '2.0', beat: '100%',
    }));
    const html = renderToStaticMarkup(<DailyNineYourNine {...props}
      rows={rows} points={Object.fromEntries(rows.map(row => [row.pitchNumber, 4]))}
      totalPoints={36} currentAtBatNumber={null} />);
    expect(html).toContain('9 of 9 completed');
    expect((html.match(/class="your-nine-row your-nine-row-above"/g) ?? []).length).toBe(9);
    expect(html).not.toContain('NOW BATTING');
    expect(html).not.toContain('Upcoming');
  });
});
