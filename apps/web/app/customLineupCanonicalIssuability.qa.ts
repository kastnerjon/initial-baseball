import { describe, expect, it, vi } from 'vitest';

// The optional post-runtime data QA tests the real server-only resolver and
// issuer, not mocked players; this suppresses Next's import sentinel in Vitest.
vi.mock('server-only', () => ({}));

import { getCanonicalSearchCandidates } from './serverCanonicalData';
import { materializeCustomLineupV2IssuedClueSnapshot } from './materializePermanentDailyIssuedClueSnapshot';

describe('post-generation canonical Custom Lineup issuance invariant', () => {
  it('issues the exact immutable clue snapshot for every canonical searchable player', () => {
    const candidates = getCanonicalSearchCandidates();
    expect(candidates.length).toBeGreaterThan(10_000);
    const uniqueIds = new Set(candidates.map(candidate => candidate.id));
    expect(uniqueIds.size).toBe(candidates.length);

    let issued = 0;
    const failures: string[] = [];
    for (const candidate of candidates) {
      try {
        const snapshot = materializeCustomLineupV2IssuedClueSnapshot([candidate.id]);
        if (snapshot.pitches.length !== 1
          || snapshot.pitches[0]?.canonicalPlayerId !== candidate.id
          || snapshot.pitches[0]?.hintValues.length !== 4) {
          throw new Error('Immutable snapshot does not match the submitted canonical identity');
        }
        issued++;
      } catch (error) {
        if (failures.length < 12) {
          failures.push(candidate.id + ': ' + (error instanceof Error ? error.message : 'unknown'));
        }
      }
    }
    expect(failures, 'Not all ' + candidates.length + ' canonical search results can be issued').toEqual([]);
    expect(issued).toBe(candidates.length);
  });
});
