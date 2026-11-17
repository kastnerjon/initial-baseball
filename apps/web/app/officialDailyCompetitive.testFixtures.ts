import type { CanonicalPlayerReveal } from '@initial-baseball/baseball-data/runtime';
import { DEFAULT_DAILY_HINT_CONFIG, DEFAULT_DAILY_STATS_HINT_CONFIG, type DailyPuzzle } from '@initial-baseball/shared';
import { createDailyProgressionTokenCodec } from './dailyProgressionToken';
import { createDailyRuntimeService } from './dailyRuntimeService';
import { createOfficialDailyCompetitiveProofCodec } from './officialDailyCompetitiveProof';
import { createOfficialDailyCompetitiveRuntime } from './officialDailyCompetitiveRuntime';


export const DATE = '2026-11-06';
export const A = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
export const B = 'daily-ed-v1-6077ee21-9370-4cf3-aa21-74c50b485591';
export const ATTEMPT = '3f3adba3-1405-4ffd-9cb9-082146a47814';
export const SECRET = 'official-competitive-test-secret-0123456789';
export const ANSWER = 'ibp_ab000000000000000000';
export const OTHER = 'ibp_cd000000000000000000';
export const tokens = createDailyProgressionTokenCodec(SECRET);
export const proofs = createOfficialDailyCompetitiveProofCodec(SECRET);

export function runtime(id: string, now = new Date('2026-11-06T12:00:00Z')) {
  const puzzle: DailyPuzzle = {
    id, puzzleDate: DATE, puzzleNumber: 194, status: 'published',
    hintConfig: DEFAULT_DAILY_HINT_CONFIG, statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches: Array.from({ length: 9 }, (_, i) => ({ pitchNumber: i + 1,
      player: { playerId: ANSWER, fullName: 'Hidden Player', displayName: 'Hidden Player',
        initials: 'HP', kind: 'hitter' as const, primaryPosition: 'CF' },
      hints: { main_decade: i === 0 ? 'FIRST HINT' : 'FUTURE HINT', teams: 'NYM', position: 'CF', stats: '3 HR' },
    })),
  };
  const reveal = { playerId: ANSWER, displayName: 'Hidden Player', playerType: 'hitter',
    career: { primaryPosition: 'CF', firstSeason: 2000, lastSeason: 2001, teamIds: [],
      batting: null, pitching: null, advanced: null }, seasons: [] } as unknown as CanonicalPlayerReveal;
  const base = createDailyRuntimeService({ createPuzzle: () => puzzle, progressionTokens: tokens,
    resolveLegacyPlayerId: id => id, getCanonicalReveal: () => reveal });
  return createOfficialDailyCompetitiveRuntime({ puzzleId: id, runtime: base, progressionTokens: tokens,
    secret: SECRET, now: () => now, newAttemptId: () => ATTEMPT });
}

