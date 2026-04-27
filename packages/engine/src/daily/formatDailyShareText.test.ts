import { expect, it } from 'vitest';
import { formatDailyShareText } from './formatDailyShareText.js';

it('formats spoiler-safe daily share text with initials and outcomes', () => {
  expect(formatDailyShareText({
    puzzleNumber: 42,
    summary: {
      runs: 4,
      hits: 5,
      outs: 3,
      strikeouts: 1,
      completed: true,
    },
    url: 'https://dailyinning.com',
    pitchLines: [
      { initials: 'KGJ', outcome: 'HR' },
      { initials: 'PM', outcome: '2B' },
      { initials: 'DW', outcome: 'K' },
    ],
  })).toBe([
    'Daily Inning #42',
    'by Initial Baseball',
    '',
    '4 R / 5 H / 3 OUT',
    '',
    'KGJ: HR',
    'PM: 2B',
    'DW: K',
    '',
    'https://dailyinning.com',
  ].join('\n'));
});
