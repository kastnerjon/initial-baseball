import { describe, expect, it } from 'vitest';
import { generateInitials } from './generateInitials.js';

describe('generateInitials', () => {
  it.each([
    ['David Wright', 'DW'],
    ['Elly De La Cruz', 'EDLC'],
    ['C.C. Sabathia', 'CS'],
    ['Ken Griffey Jr.', 'KGJ'],
    ["O'Neil Cruz", 'OC'],
    ['Julio Rodríguez', 'JR'],
    ['Bo Bichette', 'BB'],
    ['Vladimir Guerrero Jr.', 'VGJ'],
    ['Jazz Chisholm Jr.', 'JCJ'],
    ['Ha-Seong Kim', 'HSK'],
    ['CC Sabathia', 'CS'],
    ['J.D. Martinez', 'JM'],
    ['Ichiro', 'I'],
    ['  Ken   Griffey   Jr.  ', 'KGJ'],
    ['C.C.,   Sabathia', 'CS'],
    ['Dee-Strange Gordon', 'DSG'],
    ['A.J.  Pierzynski', 'AP'],
  ])('turns %s into %s', (name, expected) => {
    expect(generateInitials(name)).toBe(expected);
  });
});
