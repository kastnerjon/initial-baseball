import 'server-only';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createDailyNineLeaderboardService } from './dailyNineLeaderboardService';
import { createSupabaseDailyNineLeaderboardRepository } from './supabaseDailyNineLeaderboardRepository';

let service: ReturnType<typeof createDailyNineLeaderboardService> | null = null;

export function getDailyNineLeaderboardService() {
  service ??= createDailyNineLeaderboardService(
    createSupabaseDailyNineLeaderboardRepository(createServerSupabaseClient()),
  );
  return service;
}
