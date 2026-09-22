import { NextResponse } from 'next/server';
import { DailyRuntimeRequestError } from './dailyRuntimeService';
import { recordDailyResultWriteFailure } from './dailyResultWriteDiagnostics';
import { ServerSupabaseConfigurationError } from './serverSupabaseClient';
import { SupabaseDailyAtBatResultRepositoryError } from './supabaseDailyAtBatResultRepository';

export function atBatResultPrivateJson(value: unknown, status: number): NextResponse {
  const response = NextResponse.json(value, { status });
  response.headers.set('cache-control', 'private, no-store');
  return response;
}

export function mapAtBatResultRouteError(error: unknown): NextResponse {
  if (error instanceof DailyRuntimeRequestError) {
    return atBatResultPrivateJson({ error: 'invalid_puzzle' }, 400);
  }
  if (error instanceof ServerSupabaseConfigurationError) {
    recordDailyResultWriteFailure({
      route: 'at_bat',
      category: 'provider_configuration',
      status: 503,
    });
    return atBatResultPrivateJson({ error: 'at_bat_result_unavailable' }, 503);
  }
  if (error instanceof SupabaseDailyAtBatResultRepositoryError) {
    recordDailyResultWriteFailure({
      route: 'at_bat',
      category: 'provider_repository',
      status: 503,
    });
    return atBatResultPrivateJson({ error: 'at_bat_result_unavailable' }, 503);
  }
  recordDailyResultWriteFailure({
    route: 'at_bat',
    category: 'unexpected',
    status: 500,
  });
  return atBatResultPrivateJson({ error: 'at_bat_result_unavailable' }, 500);
}
