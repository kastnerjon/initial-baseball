import { expect, it } from 'vitest';
import { normalizeGuess } from './normalizeGuess.js';

it('lowercases and trims normalized guesses', () => {
  expect(normalizeGuess('  David Wright  ')).toBe('david wright');
});

it('strips punctuation and collapses repeated spaces', () => {
  expect(normalizeGuess(" C.C.,   Sabathia ")).toBe('cc sabathia');
});

it('removes accent marks consistently with initials handling', () => {
  expect(normalizeGuess('Julio Rodríguez')).toBe('julio rodriguez');
});
