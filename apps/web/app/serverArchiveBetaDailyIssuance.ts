import 'server-only';
import {
  createArchiveBetaDailyClueFrozenIssuanceService,
  type ArchiveBetaDailyClueFrozenIssuedPuzzleStoreResult,
  type ArchiveBetaDailyIdentity,
  type ArchiveBetaDailyIssuedPuzzleRepository,
  type DailyPuzzleRepository,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCanonicalDailyPlayer } from './canonicalDailyPlayerLookup';
import { createDailyPuzzlePitch } from './dailyPuzzleAdapters';
import {
  materializeArchiveBetaDailyIssuedClueSnapshot,
  type DailyPitchFactory,
  type IssuedDailyCluePlayerResolver,
} from './materializePermanentDailyIssuedClueSnapshot';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseDailyPuzzleRepository } from './supabaseDailyPuzzleRepository';
import { createSupabaseArchiveBetaDailyIssuedPuzzleRepository } from './supabasePermanentDailyIssuedPuzzleRepository';

export type ServerArchiveBetaDailyIssuanceInput = {
  identity: ArchiveBetaDailyIdentity;
  issuedAt: string;
};

export type ServerArchiveBetaDailyIssuanceService = {
  issue(
    input: ServerArchiveBetaDailyIssuanceInput,
  ): Promise<ArchiveBetaDailyClueFrozenIssuedPuzzleStoreResult>;
};

export type ServerArchiveBetaDailyIssuanceErrorKind = 'missing-editorial-puzzle';

export class ServerArchiveBetaDailyIssuanceError extends Error {
  constructor(
    public readonly kind: ServerArchiveBetaDailyIssuanceErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ServerArchiveBetaDailyIssuanceError';
  }
}

interface ServerArchiveBetaDailyIssuanceDependencies {
  createSupabaseClient: (
    environment: Record<string, string | undefined>,
  ) => SupabaseClient;
  createEditorialRepository: (client: SupabaseClient) => DailyPuzzleRepository;
  createIssuedPuzzleRepository: (
    client: SupabaseClient,
  ) => ArchiveBetaDailyIssuedPuzzleRepository;
  resolveCanonicalPlayer: IssuedDailyCluePlayerResolver;
  createDailyPitch: DailyPitchFactory;
}

type CreateServerArchiveBetaDailyIssuanceServiceOptions = {
  environment?: Record<string, string | undefined>;
  dependencies?: ServerArchiveBetaDailyIssuanceDependencies;
};

const DEFAULT_DEPENDENCIES: ServerArchiveBetaDailyIssuanceDependencies = {
  createSupabaseClient: createServerSupabaseClient,
  createEditorialRepository: createSupabaseDailyPuzzleRepository,
  createIssuedPuzzleRepository: createSupabaseArchiveBetaDailyIssuedPuzzleRepository,
  resolveCanonicalPlayer: getCanonicalDailyPlayer,
  createDailyPitch: createDailyPuzzlePitch,
};

/**
 * Server-only composition for explicitly requested pre-launch archive-beta issuance.
 *
 * The caller must provide an already-resolved ArchiveBetaDailyIdentity. This
 * boundary does not configure/derive the beta epoch and has no automatic trigger.
 */
export function createServerArchiveBetaDailyIssuanceService({
  environment = process.env,
  dependencies = DEFAULT_DEPENDENCIES,
}: CreateServerArchiveBetaDailyIssuanceServiceOptions = {}): ServerArchiveBetaDailyIssuanceService {
  const client = dependencies.createSupabaseClient(environment);
  const editorialRepository = dependencies.createEditorialRepository(client);
  const issuanceService = createArchiveBetaDailyClueFrozenIssuanceService(
    dependencies.createIssuedPuzzleRepository(client),
  );

  return {
    async issue(input) {
      const editorialPuzzle = await editorialRepository.getByDate(input.identity.puzzleDate);
      if (editorialPuzzle === null) {
        throw new ServerArchiveBetaDailyIssuanceError(
          'missing-editorial-puzzle',
          `No authoritative editorial Daily exists for archive beta puzzle date ${input.identity.puzzleDate}.`,
        );
      }

      const orderedCanonicalPlayerIds = [...editorialPuzzle.selections]
        .sort((left, right) => left.slot - right.slot)
        .map(selection => selection.canonicalPlayerId);
      const clueSnapshot = materializeArchiveBetaDailyIssuedClueSnapshot(
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
