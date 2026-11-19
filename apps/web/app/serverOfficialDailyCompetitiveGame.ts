import 'server-only';
import { createDailyProgressionTokenCodec } from './dailyProgressionToken';
import { createServerOfficialDailyEditionRuntime } from './serverOfficialDailyEditionRuntime';
import { createOfficialDailyAttemptReservationService } from './officialDailyAttemptReservation';
import { createOfficialDailyCompetitiveRuntime } from './officialDailyCompetitiveRuntime';
import { createOfficialDailyCompetitiveCASRuntime } from './officialDailyCompetitiveCASRuntime';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseOfficialDailyAttemptReservationStore } from './supabaseOfficialDailyAttemptReservationStore';
import { createSupabaseOfficialDailyAtomicCompletionStore } from './supabaseOfficialDailyAtomicCompletionStore';
import { createSupabaseOfficialDailyProgressionStore } from './supabaseOfficialDailyProgressionStore';
import { readReleasedOfficialDailyPuzzle } from './serverReleasedOfficialDailyPuzzle';

/** One HTTP request owns the client, released publication snapshot and verified browser identity. */
export function createServerOfficialDailyCompetitiveGame(
  puzzleId: string, browserKey: string, secret: string, maximumAttemptAgeMs: number,
  mode: 'bootstrap' | 'existing',
) {
  const now = () => new Date();
  const client = createServerSupabaseClient();
  const progressionTokens = createDailyProgressionTokenCodec(secret);
  let publication: ReturnType<typeof readReleasedOfficialDailyPuzzle> | undefined;
  const runtime = createServerOfficialDailyEditionRuntime(puzzleId, {
    createClient: () => client, progressionTokens: () => progressionTokens, now,
    readReleasedPuzzle: (db, id, at) => publication ??= readReleasedOfficialDailyPuzzle(db, id, at),
  });
  type Reserve = ReturnType<typeof createOfficialDailyAttemptReservationService>['reserve'];
  type Request = Omit<Parameters<Reserve>[0], 'browserKey'>;
  let winner: ReturnType<Reserve> | undefined;
  const reservationFor = (request: Request, access: 'bootstrap' | 'existing') => {
    if (request.puzzleId !== puzzleId) throw new Error('Official Daily edition mismatch.');
    if (!winner) {
      const store = createSupabaseOfficialDailyAttemptReservationStore(client, access);
      winner = createOfficialDailyAttemptReservationService({ store, now }).reserve({ ...request, browserKey });
    }
    return winner;
  };
  const reserveAttempt = (request: Request) => reservationFor(request, mode);
  const readExistingAttempt = (request: Request) => reservationFor(request, 'existing');
  const shared = { puzzleId, now, progressionTokens, secret, reserveAttempt };
  const game = createOfficialDailyCompetitiveCASRuntime({
    ...shared, runtime: createOfficialDailyCompetitiveRuntime({ ...shared, runtime, readExistingAttempt }),
    progression: createSupabaseOfficialDailyProgressionStore(client),
    completion: createSupabaseOfficialDailyAtomicCompletionStore(client), maximumAttemptAgeMs,
  });
  return {
    ...game,
    async getScorecard(date: string) {
      const reservation = await readExistingAttempt({ puzzleId, puzzleDate: date, rulesetVersion: 'points-v4' });
      const card = await game.readScorecard(reservation);
      const released = await publication;
      if (!released || released.id !== puzzleId || released.puzzleDate !== date) {
        throw new Error('Official Daily scorecard unavailable.');
      }
      const resolvedNames = card.atBats.map(fact => {
        const pitch = released.pitches[fact.pitchNumber - 1];
        if (!pitch || pitch.pitchNumber !== fact.pitchNumber || pitch.player.initials !== fact.initials) {
          throw new Error('Official Daily scorecard unavailable.');
        }
        return pitch.player.displayName;
      });
      return { ...card, resolvedNames };
    },
  };
}
