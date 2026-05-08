import { baseballPlayers } from '@initial-baseball/baseball-data';
import { normalizeGuess, searchPlayers } from '@initial-baseball/engine';
import { describe, expect, it } from 'vitest';

describe('player search quality with generated data', () => {
  it('returns David Ortiz once for a partial name search', () => {
    const results = searchPlayers('david ort', baseballPlayers);

    expect(results.filter((result) => result.displayName === 'David Ortiz')).toHaveLength(1);
  });

  it('does not return duplicate normalized display names', () => {
    const normalizedDisplayNames = searchPlayers('david', baseballPlayers)
      .map((result) => normalizeGuess(result.displayName));

    expect(new Set(normalizedDisplayNames).size).toBe(normalizedDisplayNames.length);
  });

  it('finds Luis Arráez with unaccented and accented queries', () => {
    for (const query of ['luis arraez', 'arraez', 'luis arráez', 'arráez']) {
      expect(searchPlayers(query, baseballPlayers)[0]?.displayName).toContain('Arráez');
    }
  });
});
