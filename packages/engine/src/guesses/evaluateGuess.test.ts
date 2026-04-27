import { expect, it } from 'vitest';
import { evaluateGuess } from './evaluateGuess.js';

it('returns true when the submitted player id matches the correct player id', () => {
  expect(evaluateGuess('player-42', 'player-42')).toBe(true);
});

it('returns false when the submitted player id does not match the correct player id', () => {
  expect(evaluateGuess('player-42', 'player-99')).toBe(false);
});
