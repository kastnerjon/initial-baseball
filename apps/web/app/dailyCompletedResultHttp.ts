import { NextResponse } from 'next/server';
import { DailyRuntimeRequestError } from './dailyRuntimeService';
import { recordDailyResultWriteFailure } from './dailyResultWriteDiagnostics';
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
  if (error instanceof ServerSupabaseConfigurationError) {
    recordDailyResultWriteFailure({
      route: 'completed',
      category: 'provider_configuration',
      status: 503,
    });
    return completedResultPrivateJson({ error: 'completed_result_unavailable' }, 503);
  }
  if (error instanceof SupabaseDailyCompletedResultRepositoryError) {
    recordDailyResultWriteFailure({
      route: 'completed',
      category: 'provider_repository',
      status: 503,
    });
    return completedResultPrivateJson({ error: 'completed_result_unavailable' }, 503);
  }
  recordDailyResultWriteFailure({
    route: 'completed',
    category: 'unexpected',
    status: 500,
  });
  return completedResultPrivateJson({ error: 'completed_result_unavailable' }, 500);
}
