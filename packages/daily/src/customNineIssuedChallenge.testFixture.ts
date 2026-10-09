import { createPermanentDailyIssuedClueSnapshot } from './permanentDailyIssuedClueSnapshot';
import type { CustomNineIssuedChallengeInput } from './customNineIssuedChallenge';

export const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
export const IDS = Array.from({ length: 9 }, (_, index) => 'player-' + (index + 1));

export function fixture(): CustomNineIssuedChallengeInput {
  return {
    puzzleId: ID,
    canonicalPlayerIds: [...IDS],
    clueSnapshot: createPermanentDailyIssuedClueSnapshot({
      hintLayout: [
        { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade' },
        { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
        { slot: 3, hintType: 'position', displayLabel: 'Position' },
        { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
      ],
      pitches: IDS.map((canonicalPlayerId, index) => ({
        pitchNumber: index + 1,
        canonicalPlayerId,
        initials: 'P' + (index + 1),
        hintValues: ['2000s', 'Mets', 'SS', 'HR 123'],
      })),
    }),
    issuedAt: '2026-10-08T23:45:00-04:00',
  };
}

