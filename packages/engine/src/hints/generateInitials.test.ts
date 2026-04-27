import { describe, expect, it } from 'vitest';
import { generateInitials } from './generateInitials.js';

describe('generateInitials', () => {
  it.each([
    ['Ken Griffey Jr.', 'KG'],
    ['CC Sabathia', 'CS'],
    ['J.D. Martinez', 'JM'],
    ['Ichiro', 'I'],
    ['Elly De La Cruz', 'EDLC'],
  ])('turns %s into %s', (name, expected) => {
    expect(generateInitials(name)).toBe(expected);
  });
});
