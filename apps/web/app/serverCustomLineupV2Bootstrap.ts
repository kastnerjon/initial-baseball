import 'server-only';
import { createHmac } from 'node:crypto';
import {
  cloneCustomLineupIssuedChallenge, validateCustomLineupPuzzleId,
  type CustomLineupIssuedChallenge,
} from '@initial-baseball/daily';
import type { Player } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCanonicalDailyPlayer } from './canonicalDailyPlayerLookup';
import { createDailyProgressionTokenCodec } from './dailyProgressionToken';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { createDailyRuntimeService } from './dailyRuntimeService';
import { CUSTOM_NINE_SESSION_DATE, materializeCustomNineSessionPuzzle } from './serverCustomNineBootstrap';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseCustomLineupV2IssuedReader } from './supabaseCustomLineupV2IssuedReader';

const SIGNING_DOMAIN = 'initial-baseball:custom-lineup-v2:progression:v1';

/** An independent signing domain and explicit 10-pitch limit; Daily/v1 stay nine-only. */
export function createCustomLineupV2ProgressionTokens(secret: string) {
  const domainSecret = createHmac('sha256', secret).update(SIGNING_DOMAIN).digest('hex');
  return createDailyProgressionTokenCodec(domainSecret, 10);
}

type Dependencies = {
  createSupabaseClient: (env: Record<string, string | undefined>) => SupabaseClient;
  readChallenge: (client: SupabaseClient, puzzleId: string) => Promise<CustomLineupIssuedChallenge | null>;
  resolvePlayer: (playerId: string) => Player | null;
  getSecret: (env: Record<string, string | undefined>) => string;
};
const DEFAULT: Dependencies = {
  createSupabaseClient: createServerSupabaseClient,
  readChallenge: (client, id) => createSupabaseCustomLineupV2IssuedReader(client).getById(id),
  resolvePlayer: getCanonicalDailyPlayer,
  getSecret: getDailyProgressionSecret,
};

/**
 * Private v2 issued-challenge opening only. Never call from an anonymous route:
 * browser credential reservation, authorized hint depth and completed-attempt
 * persistence require subsequent reviewed services.
 */
export function createServerCustomLineupV2BootstrapService({
  environment = process.env,
  dependencies = DEFAULT,
}: {
  environment?: Record<string, string | undefined>;
  dependencies?: Dependencies;
} = {}) {
  return {
    async bootstrap(puzzleId: unknown) {
      if (typeof puzzleId !== 'string') return null;
      try { validateCustomLineupPuzzleId(puzzleId); }
      catch { return null; }
      const client = dependencies.createSupabaseClient(environment);
      const row = await dependencies.readChallenge(client, puzzleId);
      if (row === null) return null;
      // Revalidate even injected repositories. No client-controlled length.
      const challenge = cloneCustomLineupIssuedChallenge(row);
      if (challenge.puzzleId !== puzzleId) throw new Error('Custom Lineup challenge identity mismatch.');
      const puzzle = materializeCustomNineSessionPuzzle(challenge, dependencies.resolvePlayer);
      const tokens = createCustomLineupV2ProgressionTokens(dependencies.getSecret(environment));
      const runtime = createDailyRuntimeService({
        createPuzzle: date => {
          if (date !== CUSTOM_NINE_SESSION_DATE) throw new Error('Invalid Custom Lineup session scope.');
          return puzzle;
        },
        progressionTokens: tokens,
        resolveLegacyPlayerId: () => { throw new Error('Legacy Custom Lineup player IDs unsupported.'); },
        getCanonicalReveal: () => { throw new Error('Custom Lineup answer resolution not enabled.'); },
      });
      const result = await runtime.getBootstrap(CUSTOM_NINE_SESSION_DATE, 'points-v4');
      return {
        puzzleId: challenge.puzzleId,
        rulesetVersion: challenge.rulesetVersion,
        atBats: result.puzzle.pitches.map(p => ({ pitchNumber: p.pitchNumber, initials: p.initials })),
        progressionToken: result.progressionToken,
        hintBundle: result.hintBundle,
      };
    },
  };
}
