import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
function token(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})\\s*;`, 'i'));
  if (!match) throw Error(`Missing CSS color token: ${name}`);
  return match[1]!;
}

function luminance(hex: string): number {
  const colors = [1, 3, 5].map(offset =>
    Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = colors.map(value =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}
function contrast(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

describe('sitewide contrast design tokens', () => {
  it('keeps default body text comfortably above the WCAG AA threshold', () => {
    for (const background of [token('paper'), token('paper-light')]) {
      expect(contrast(token('ink'), background)).toBeGreaterThanOrEqual(7);
      expect(contrast(token('ink-soft'), background)).toBeGreaterThanOrEqual(7);
    }
  });
  it('gives primary UI borders at least 3:1 contrast on paper and cards', () => {
    for (const background of [token('paper'), token('paper-light')]) {
      expect(contrast(token('line'), background)).toBeGreaterThanOrEqual(3);
    }
  });
  it('retains contrasting white text on the primary green and deep green', () => {
    expect(contrast('#ffffff', token('clubhouse'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', token('clubhouse-deep'))).toBeGreaterThanOrEqual(4.5);
  });
});
