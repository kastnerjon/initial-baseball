import { describe, expect, it } from 'vitest';
import type { DailyHintBundle } from './dailyRuntimeContracts';
import { revealNextHintFromBundle } from './dailyHintBundle';

const bundle: DailyHintBundle = {
  pitchNumber: 1,
  revealedCount: 0,
  hints: [
    { slot: 1, hintType: 'main_decade', hintLabel: 'Main decade played in', hintValue: '2000s' },
    { slot: 2, hintType: 'teams', hintLabel: 'Teams', hintValue: 'SEA, CIN' },
    { slot: 3, hintType: 'position', hintLabel: 'Position', hintValue: 'CF' },
    { slot: 4, hintType: 'stats', hintLabel: 'Stats', hintValue: '630 HR' },
  ],
  checkpoints: [1, 2, 3, 4].map(revealedCount => ({
    revealedCount: revealedCount as 1 | 2 | 3 | 4,
    progressionToken: `token-${revealedCount}`,
  })),
};

describe('revealNextHintFromBundle', () => {
  it('reveals the next authorized hint and checkpoint without network state', () => {
    expect(revealNextHintFromBundle(bundle, 0)).toEqual({
      hint: {
        hintType: 'main_decade',
        hintLabel: 'Main decade played in',
        hintValue: '2000s',
      },
      revealedCount: 1,
      progressionToken: 'token-1',
    });

    expect(revealNextHintFromBundle(bundle, 2)).toMatchObject({
      hint: { hintType: 'position', hintValue: 'CF' },
      revealedCount: 3,
      progressionToken: 'token-3',
    });
  });

  it('fails closed when a checkpoint is missing', () => {
    expect(() => revealNextHintFromBundle({
      ...bundle,
      checkpoints: bundle.checkpoints.filter(checkpoint => checkpoint.revealedCount !== 2),
    }, 1)).toThrow(/missing authorized hint checkpoint 2/);
  });

  it('rejects revealing beyond the fourth hint', () => {
    expect(() => revealNextHintFromBundle(bundle, 4)).toThrow(/already revealed/);
  });
});
