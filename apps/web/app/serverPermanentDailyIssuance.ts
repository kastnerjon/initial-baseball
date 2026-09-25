import 'server-only';
import {
  createPermanentDailyClueFrozenIssuanceService,
  type DailyPuzzleRepository,
  type PermanentDailyIdentity,
  type PermanentDailyClueFrozenIssuedPuzzleStoreResult,
  type PermanentDailyIssuedPuzzleRepository,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCanonicalDailyPlayer } from './canonicalDailyPlayerLookup';
import { createDailyPuzzlePitch } from './dailyPuzzleAdapters';
import {
  materializePermanentDailyIssuedClueSnapshot,
  type DailyPitchFactory,
  type PermanentDailyCluePlayerResolver,
} from './materializePermanentDailyIssuedClueSnapshot';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseDailyPuzzleRepository } from './supabaseDailyPuzzleRepository';
import { createSupabasePermanentDailyIssuedPuzzleRepository } from './supabasePermanentDailyIssuedPuzzleRepository';

export type ServerPermanentDailyIssuanceInput = {
  identity: PermanentDailyIdentity;
  issuedAt: string;
};

export type ServerPermanentDailyIssuanceService = {
  issue(
    input: ServerPermanentDailyIssuanceInput,
  ): Promise<PermanentDailyClueFrozenIssuedPuzzleStoreResult>;
};

export type ServerPermanentDailyIssuanceErrorKind = 'missing-editorial-puzzle';

export class ServerPermanentDailyIssuanceError extends Error {
  constructor(
    public readonly kind: ServerPermanentDailyIssuanceErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ServerPermanentDailyIssuanceError';
  }
}

interface ServerPermanentDailyIssuanceDependencies {
  createSupabaseClient: (
    environment: Record<string, string | undefined>,
  ) => SupabaseClient;
  createEditorialRepository: (client: SupabaseClient) => DailyPuzzleRepository;
  createIssuedPuzzleRepository: (
    client: SupabaseClient,
  ) => PermanentDailyIssuedPuzzleRepository;
  resolveCanonicalPlayer: PermanentDailyCluePlayerResolver;
  createDailyPitch: DailyPitchFactory;
}

type CreateServerPermanentDailyIssuanceServiceOptions = {
  environment?: Record<string, string | undefined>;
  dependencies?: ServerPermanentDailyIssuanceDependencies;
};

const DEFAULT_DEPENDENCIES: ServerPermanentDailyIssuanceDependencies = {
  createSupabaseClient: createServerSupabaseClient,
  createEditorialRepository: createSupabaseDailyPuzzleRepository,
  createIssuedPuzzleRepository: createSupabasePermanentDailyIssuedPuzzleRepository,
  resolveCanonicalPlayer: getCanonicalDailyPlayer,
  createDailyPitch: createDailyPuzzlePitch,
};

/**
 * Server-only composition boundary for explicitly requested permanent issuance.
 *
 * This service does not resolve or configure the launch epoch. Its caller must
 * supply a PermanentDailyIdentity, keeping launch-date policy outside the web
 * persistence composition.
 */
export function createServerPermanentDailyIssuanceService({
  environment = process.env,
  dependencies = DEFAULT_DEPENDENCIES,
}: CreateServerPermanentDailyIssuanceServiceOptions = {}): ServerPermanentDailyIssuanceService {
  const client = dependencies.createSupabaseClient(environment);
  const editorialRepository = dependencies.createEditorialRepository(client);
  const issuanceService = createPermanentDailyClueFrozenIssuanceService(
    dependencies.createIssuedPuzzleRepository(client),
  );

  return {
    async issue(input) {
      const editorialPuzzle = await editorialRepository.getByDate(input.identity.puzzleDate);
      if (editorialPuzzle === null) {
        throw new ServerPermanentDailyIssuanceError(
          'missing-editorial-puzzle',
          `No authoritative editorial Daily exists for permanent puzzle date ${input.identity.puzzleDate}.`,
        );
      }

      const orderedCanonicalPlayerIds = [...editorialPuzzle.selections]
        .sort((left, right) => left.slot - right.slot)
        .map(selection => selection.canonicalPlayerId);
      const clueSnapshot = materializePermanentDailyIssuedClueSnapshot(
        orderedCanonicalPlayerIds,
        dependencies.resolveCanonicalPlayer,
        dependencies.createDailyPitch,
      );

      return issuanceService.issue({
        identity: input.identity,
        editorialPuzzle,
        clueSnapshot,
        issuedAt: input.issuedAt,
      });
    },
  };
}
