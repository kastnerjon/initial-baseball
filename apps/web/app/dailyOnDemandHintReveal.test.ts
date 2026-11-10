import { DEFAULT_DAILY_HINT_CONFIG } from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import type { DailyHintBundle } from './dailyRuntimeContracts';
import { applyOnDemandDailyHintReveal } from './dailyOnDemandHintReveal';

const initial: DailyHintBundle = {
  pitchNumber: 1, revealedCount: 0, hints: [], checkpoints: [],
};
const authorized = (slot: number, token = 'token-' + slot) => ({
  hint: {
    hintType: DEFAULT_DAILY_HINT_CONFIG[slot - 1]!.hintType,
    hintLabel: DEFAULT_DAILY_HINT_CONFIG[slot - 1]!.displayLabel,
    hintValue: 'PRIVATE_HINT_' + slot,
  },
  progressionToken: token,
});

function apply(bundle: DailyHintBundle, response: unknown, token = 'token-0') {
  return applyOnDemandDailyHintReveal(bundle, DEFAULT_DAILY_HINT_CONFIG, token, response);
}

describe('source-staged on-demand Daily hint reconciliation', () => {
  it('accepts exactly one signed-server response per reveal and never creates future hints', () => {
    let bundle = initial;
    let token = 'token-0';
    for (let slot = 1; slot <= 4; slot += 1) {
      const result = apply(bundle, authorized(slot), token);
      expect(result.reveal.hint.hintValue).toBe('PRIVATE_HINT_' + slot);
      expect(result.reveal.revealedCount).toBe(slot);
      expect(result.hintBundle.hints.map(hint => hint.hintValue))
        .toEqual(Array.from({ length: slot }, (_, index) => 'PRIVATE_HINT_' + (index + 1)));
      expect(result.hintBundle.checkpoints).toEqual([]);
      expect(JSON.stringify(result)).not.toContain('PRIVATE_HINT_' + (slot + 1));
      bundle = result.hintBundle;
      token = result.reveal.progressionToken;
    }
    expect(() => apply(bundle, authorized(4), token)).toThrow(/Incompatible/);
  });

  it('fails closed for a replayed or wrong-slot response without echoing private content', () => {
    const cases = [
      authorized(1, 'token-0'),
      authorized(2),
      { ...authorized(1), hint: { ...authorized(1).hint, hintLabel: 'WRONG' } },
      { ...authorized(1), futureHints: ['PRIVATE_FUTURE_HINT'] },
      { ...authorized(1), hint: { ...authorized(1).hint, hintValue: '' } },
      { ...authorized(1), hint: { ...authorized(1).hint, extra: 'PRIVATE_FUTURE_HINT' } },
      { ...authorized(1), progressionToken: 'x'.repeat(4097) },
      null,
      'PRIVATE_FUTURE_HINT',
    ];
    for (const response of cases) {
      try {
        apply(initial, response);
        throw new Error('Unexpected acceptance');
      } catch (error) {
        expect(String(error)).toMatch(/Incompatible/);
        expect(String(error)).not.toContain('PRIVATE_FUTURE_HINT');
      }
    }
  });

  it('refuses locally preloaded future checkpoints, shifted slots and stale count', () => {
    const extras: DailyHintBundle[] = [
      { ...initial, checkpoints: [{ revealedCount: 1, progressionToken: 'FUTURE' }] },
      { ...initial, hints: [{ slot: 1, ...authorized(1).hint }] },
      { ...initial, revealedCount: 1, hints: [] },
      { ...initial, pitchNumber: 0 },
      {
        ...initial, revealedCount: 1,
        hints: [{ slot: 2, ...authorized(1).hint }],
      },
    ];
    for (const bundle of extras) {
      expect(() => apply(bundle, authorized(1))).toThrow(/Incompatible/);
    }
  });

  it('does not mutate a previous hint bundle or expose its unrevealed values', () => {
    const old = structuredClone(initial);
    const result = apply(initial, authorized(1));
    expect(initial).toEqual(old);
    expect(result.hintBundle.hints).toHaveLength(1);
    expect(result.hintBundle.hints[0]?.slot).toBe(1);
  });
});
