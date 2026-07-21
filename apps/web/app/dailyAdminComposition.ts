import 'server-only';
import type { DailyPuzzleRepository } from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireDailyAdminPrincipal } from './dailyAdminAuthorization';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseDailyPuzzleRepository } from './supabaseDailyPuzzleRepository';

export interface DailyAdminContext {
  actorId: string;
  repository: DailyPuzzleRepository;
}

interface DailyAdminCompositionDependencies {
  createSupabaseClient: (
    environment: Record<string, string | undefined>,
  ) => SupabaseClient;
  createRepository: (client: SupabaseClient) => DailyPuzzleRepository;
}

interface CreateDailyAdminContextOptions {
  authorizationHeader: string | null;
  environment?: Record<string, string | undefined>;
  dependencies?: DailyAdminCompositionDependencies;
}

const DEFAULT_DEPENDENCIES: DailyAdminCompositionDependencies = {
  createSupabaseClient: createServerSupabaseClient,
  createRepository: createSupabaseDailyPuzzleRepository,
};

export function createDailyAdminContext({
  authorizationHeader,
  environment = process.env,
  dependencies = DEFAULT_DEPENDENCIES,
}: CreateDailyAdminContextOptions): DailyAdminContext {
  const { actorId } = requireDailyAdminPrincipal(authorizationHeader, environment);
  const client = dependencies.createSupabaseClient(environment);
  const repository = dependencies.createRepository(client);

  return { actorId, repository };
}
