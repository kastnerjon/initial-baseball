import 'server-only';
import { createHmac } from 'node:crypto';
import {
  createCustomNineIssuedChallengeService,
  validateCustomNinePuzzleId,
  type CustomNineIssuedChallenge,
  type CustomNineIssuedChallengeRepository,
} from '@initial-baseball/daily';
import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyPuzzle,
  type Player,
} from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCanonicalDailyPlayer } from './canonicalDailyPlayerLookup';
import { createPlayerIdentity } from './dailyPuzzleAdapters';
import {
  createDailyProgressionTokenCodec,
  type DailyProgressionTokenCodec,
} from './dailyProgressionToken';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { createDailyRuntimeService } from './dailyRuntimeService';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseCustomNineIssuedChallengeRepository } from './supabaseCustomNineIssuedChallengeRepository';

// A fixed noncalendar sentinel only for the legacy Daily claims shape.
// It is not an issuance date and is never included in the public response.
export const CUSTOM_NINE_SESSION_DATE = '1970-01-01';
const CUSTOM_SIGNING_DOMAIN = 'initial-baseball:custom-nine:progression:v1';

export function createCustomNineProgressionTokens(secret: string): DailyProgressionTokenCodec {
  const domainSecret = createHmac('sha256', secret).update(CUSTOM_SIGNING_DOMAIN).digest('hex');
  return createDailyProgressionTokenCodec(domainSecret);
}

export type CustomNineBootstrapResponse = Readonly<{
  puzzleId: string;
  rulesetVersion: 'points-v4';
  atBats: readonly Readonly<{ pitchNumber: number; initials: string }>[];
  progressionToken: string;
  hintBundle: Awaited<ReturnType<ReturnType<typeof createDailyRuntimeService>['getBootstrap']>>['hintBundle'];
}>;

type BootstrapDependencies = {
  createSupabaseClient: (env: Record<string, string | undefined>) => SupabaseClient;
  createRepository: (client: SupabaseClient) => CustomNineIssuedChallengeRepository;
  resolvePlayer: (id: string) => Player | null;
  getProgressionSecret: (env: Record<string, string | undefined>) => string;
};

const DEFAULT_DEPENDENCIES: BootstrapDependencies = {
  createSupabaseClient: createServerSupabaseClient,
  createRepository: createSupabaseCustomNineIssuedChallengeRepository,
  resolvePlayer: getCanonicalDailyPlayer,
  getProgressionSecret: getDailyProgressionSecret,
};

/**
 * Creates only the first signed active-at-bat bundle. Follow-up endpoints
 * must revalidate the challenge ID and token using the same isolated codec.
 */
export function createServerCustomNineBootstrapService({
  environment = process.env,
  dependencies = DEFAULT_DEPENDENCIES,
}: {
  environment?: Record<string, string | undefined>;
  dependencies?: BootstrapDependencies;
} = {}) {
  return {
    async bootstrap(puzzleId: unknown): Promise<CustomNineBootstrapResponse | null> {
      if (typeof puzzleId !== 'string') return null;
      try { validateCustomNinePuzzleId(puzzleId); } catch { return null; }
      const repository = dependencies.createRepository(dependencies.createSupabaseClient(environment));
      const challenge = await createCustomNineIssuedChallengeService(repository).getById(puzzleId);
      if (challenge === null) return null;

      const puzzle = materializeCustomNineSessionPuzzle(challenge, dependencies.resolvePlayer);
      const tokens = createCustomNineProgressionTokens(dependencies.getProgressionSecret(environment));
      const runtime = createDailyRuntimeService({
        createPuzzle: date => {
          if (date !== CUSTOM_NINE_SESSION_DATE) throw new Error('Invalid Custom Nine session scope.');
          return puzzle;
        },
        progressionTokens: tokens,
        resolveLegacyPlayerId: () => { throw new Error('Legacy Custom Nine player IDs are unsupported.'); },
        getCanonicalReveal: () => { throw new Error('Custom Nine answer resolution is not yet enabled.'); },
      });
      const result = await runtime.getBootstrap(CUSTOM_NINE_SESSION_DATE);
      return {
        puzzleId: challenge.puzzleId,
        rulesetVersion: challenge.rulesetVersion,
        atBats: result.puzzle.pitches.map(pitch => ({
          pitchNumber: pitch.pitchNumber,
          initials: pitch.initials,
        })),
        progressionToken: result.progressionToken,
        hintBundle: result.hintBundle,
      };
    },
  };
}

function materializeCustomNineSessionPuzzle(
  challenge: CustomNineIssuedChallenge,
  resolvePlayer: (id: string) => Player | null,
): DailyPuzzle {
  const hints = challenge.clueSnapshot.hintLayout.map(slot => {
    const template = DEFAULT_DAILY_HINT_CONFIG.find(hint => hint.slot === slot.slot);
    if (!template) throw new Error('Unsupported Custom Nine hint slot.');
    return { ...slot, result: template.result };
  });
  const pitches = challenge.clueSnapshot.pitches.map((frozen, index) => {
    const canonicalId = challenge.canonicalPlayerIds[index];
    if (!canonicalId || canonicalId !== frozen.canonicalPlayerId || frozen.pitchNumber !== index + 1) {
      throw new Error('Custom Nine frozen batting order mismatch.');
    }
    const player = resolvePlayer(canonicalId);
    if (player === null) throw new Error('Custom Nine player facts unavailable.');
    const issuedHints: DailyPuzzle['pitches'][number]['hints'] = {};
    challenge.clueSnapshot.hintLayout.forEach((slot, position) => {
      const value = frozen.hintValues[position];
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error('Invalid frozen Custom Nine hint.');
      }
      issuedHints[slot.hintType] = value;
    });
    return {
      pitchNumber: frozen.pitchNumber,
      player: { ...createPlayerIdentity(player), playerId: canonicalId, initials: frozen.initials },
      hints: issuedHints,
    };
  });
  return {
    id: challenge.puzzleId,
    puzzleDate: CUSTOM_NINE_SESSION_DATE,
    puzzleNumber: 1,
    status: 'published',
    hintConfig: hints,
    statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches,
  };
}
