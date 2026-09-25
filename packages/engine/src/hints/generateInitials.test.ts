import { describe, expect, it } from 'vitest';
import { generateInitials } from './generateInitials.js';

describe('generateInitials', () => {
  it.each([
    ['David Wright', 'DW'],
    ['Elly De La Cruz', 'EDLC'],
    ['C.C. Sabathia', 'CS'],
    ['Ken Griffey Jr.', 'KG'],
    ["O'Neil Cruz", 'OC'],
    ['Julio Rodríguez', 'JR'],
    ['Bo Bichette', 'BB'],
    ['Vladimir Guerrero Jr.', 'VG'],
    ['Jazz Chisholm Jr.', 'JC'],
    ['Tony Gwynn Sr.', 'TG'],
    ['Tony Gwynn sR', 'TG'],
    ['Tony Gwynn SR.  ', 'TG'],
    ['Ken Griffey III', 'KGI'],
    ['Ken Griffey II', 'KGI'],
    ['Ken Jr. Griffey', 'KJG'],
    ['Ha-Seong Kim', 'HSK'],
    ['CC Sabathia', 'CS'],
    ['J.D. Martinez', 'JM'],
    ['Ichiro', 'I'],
    ['  Ken   Griffey   Jr.  ', 'KG'],
    ['C.C.,   Sabathia', 'CS'],
    ['Dee-Strange Gordon', 'DSG'],
    ['A.J.  Pierzynski', 'AP'],
  ])('turns %s into %s', (name, expected) => {
    expect(generateInitials(name)).toBe(expected);
  });
});
