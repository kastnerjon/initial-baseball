import { describe, expect, it, vi } from 'vitest';
import type { OfficialDailyPublicationInput } from '@initial-baseball/daily';

vi.mock('server-only', () => ({}));
vi.mock('./canonicalDailyPlayerLookup', () => ({ getCanonicalDailyPlayer: vi.fn() }));
vi.mock('./dailyPuzzleAdapters', () => ({ createDailyPuzzlePitch: vi.fn() }));

import { getCanonicalDailyPlayer } from './canonicalDailyPlayerLookup';
import { createDailyPuzzlePitch } from './dailyPuzzleAdapters';
import { prepareServerOfficialDailyPublication } from './materializePermanentDailyIssuedClueSnapshot';

const input: OfficialDailyPublicationInput = {
  occurrenceId: 'c52a6ff5-a6cb-4ccd-900e-0892e5a705b8', editionKey: 'mixed', editionNumber: 3,
  editorial: {
    puzzleDate: '2026-11-06', puzzleNumber: 194, status: 'scheduled',
    selections: Array.from({ length: 9 }, (_, i) => ({ slot: i + 1, canonicalPlayerId: 'private-player-' + i, source: 'manual' })),
  },
};

describe('server official Daily preparation', () => {
  it('keeps unresolved future answers out of error messages', () => {
    vi.mocked(getCanonicalDailyPlayer).mockReturnValue(null);
    expect(() => prepareServerOfficialDailyPublication(input)).toThrow(/^Unable to prepare this official Daily edition\. Check its metadata, selections and clues\.$/);
    expect(createDailyPuzzlePitch).not.toHaveBeenCalled();
  });
});
