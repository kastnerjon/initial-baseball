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
  const reservations = createOfficialDailyAttemptReservationService({
    store: createSupabaseOfficialDailyAttemptReservationStore(client, mode), now,
  });
  type Request = Omit<Parameters<typeof reservations.reserve>[0], 'browserKey'>;
  let winner: ReturnType<typeof reservations.reserve> | undefined;
  const reserveAttempt = (request: Request) => {
    if (request.puzzleId !== puzzleId) throw new Error('Official Daily edition mismatch.');
    return winner ??= reservations.reserve({ ...request, browserKey });
  };
  const shared = { puzzleId, now, progressionTokens, secret, reserveAttempt };
  return createOfficialDailyCompetitiveCASRuntime({
    ...shared, runtime: createOfficialDailyCompetitiveRuntime({ ...shared, runtime }),
    progression: createSupabaseOfficialDailyProgressionStore(client),
    completion: createSupabaseOfficialDailyAtomicCompletionStore(client), maximumAttemptAgeMs,
  });
}
