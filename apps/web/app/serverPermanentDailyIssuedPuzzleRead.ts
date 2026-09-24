import 'server-only';
import {
  createPermanentDailyIssuedPuzzleReadService,
  type PermanentDailyIssuedPuzzleReadRepository,
  type PermanentDailyIssuedPuzzleReadService,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from './serverSupabaseClient';
import {
  createSupabasePermanentDailyIssuedPuzzleReadRepository,
} from './supabasePermanentDailyIssuedPuzzleRepository';

interface ServerPermanentDailyIssuedPuzzleReadDependencies {
  createSupabaseClient: (
    environment: Record<string, string | undefined>,
  ) => SupabaseClient;
  createReadRepository: (
    client: SupabaseClient,
  ) => PermanentDailyIssuedPuzzleReadRepository;
}

type CreateServerPermanentDailyIssuedPuzzleReadServiceOptions = {
  environment?: Record<string, string | undefined>;
  dependencies?: ServerPermanentDailyIssuedPuzzleReadDependencies;
};

const DEFAULT_DEPENDENCIES: ServerPermanentDailyIssuedPuzzleReadDependencies = {
  createSupabaseClient: createServerSupabaseClient,
  createReadRepository: createSupabasePermanentDailyIssuedPuzzleReadRepository,
};

/**
 * Server-only composition for reading already-frozen permanent Daily puzzles.
 *
 * This boundary wires the portable read service to the Supabase provider. It
 * deliberately does not resolve a launch epoch, materialize player facts, or
 * expose an HTTP/archive route.
 */
export function createServerPermanentDailyIssuedPuzzleReadService({
  environment = process.env,
  dependencies = DEFAULT_DEPENDENCIES,
}: CreateServerPermanentDailyIssuedPuzzleReadServiceOptions = {}): PermanentDailyIssuedPuzzleReadService {
  const client = dependencies.createSupabaseClient(environment);
  const repository = dependencies.createReadRepository(client);
  return createPermanentDailyIssuedPuzzleReadService(repository);
}
