import { NextResponse } from 'next/server';
import { DailyRuntimeRequestError } from './dailyRuntimeService';
import { ServerSupabaseConfigurationError } from './serverSupabaseClient';
import { SupabaseDailyCompletedResultRepositoryError } from './supabaseDailyCompletedResultRepository';

export function completedResultPrivateJson(value: unknown, status: number): NextResponse {
  const response = NextResponse.json(value, { status });
  response.headers.set('cache-control', 'private, no-store');
  return response;
}

export function mapCompletedResultRouteError(error: unknown): NextResponse {
  if (error instanceof DailyRuntimeRequestError) {
    return completedResultPrivateJson({ error: 'invalid_puzzle' }, 400);
  }
  if (error instanceof ServerSupabaseConfigurationError
    || error instanceof SupabaseDailyCompletedResultRepositoryError) {
    return completedResultPrivateJson({ error: 'completed_result_unavailable' }, 503);
  }
  return completedResultPrivateJson({ error: 'completed_result_unavailable' }, 500);
}
