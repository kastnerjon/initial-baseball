import 'server-only';
import type { DailyPuzzleRepository } from '@initial-baseball/daily';
import { createPublicDailyPuzzleCacheInvalidatingRepository } from './publicDailyPuzzleCache';
import { requireDailyChatOpsPrincipal } from './dailyChatOpsAuthorization';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseDailyPuzzleRepository } from './supabaseDailyPuzzleRepository';

export interface DailyChatOpsContext {
  actorId: string;
  repository: DailyPuzzleRepository;
}

export function createDailyChatOpsContext(
  authorizationHeader: string | null,
  environment: Record<string, string | undefined> = process.env,
): DailyChatOpsContext {
  const { actorId } = requireDailyChatOpsPrincipal(authorizationHeader, environment);
  const client = createServerSupabaseClient(environment);
  const repository = createPublicDailyPuzzleCacheInvalidatingRepository(
    createSupabaseDailyPuzzleRepository(client),
  );
  return { actorId, repository };
}
