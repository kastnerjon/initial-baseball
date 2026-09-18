import { NextResponse } from 'next/server';
import { DailyRuntimeRequestError } from '../../../dailyRuntimeService';
import { submitDailyCompletedResult } from '../../../serverDailyCompletedResults';
import { ServerSupabaseConfigurationError } from '../../../serverSupabaseClient';
import { SupabaseDailyCompletedResultRepositoryError } from '../../../supabaseDailyCompletedResultRepository';

export async function POST(request: Request): Promise<NextResponse> {
  let submission: unknown;
  try {
    submission = await request.json();
  } catch {
    return privateJson({ error: 'invalid_submission' }, 400);
  }

  try {
    const result = await submitDailyCompletedResult(submission);

    if (result.ok) {
      return privateJson(
        { status: result.status },
        result.status === 'created' ? 201 : 200,
      );
    }

    return privateJson(
      { error: result.error },
      result.error === 'idempotency_conflict' ? 409 : 400,
    );
  } catch (error) {
    if (error instanceof DailyRuntimeRequestError) {
      return privateJson({ error: 'invalid_puzzle' }, 400);
    }
    if (error instanceof ServerSupabaseConfigurationError
      || error instanceof SupabaseDailyCompletedResultRepositoryError) {
      return privateJson({ error: 'completed_result_unavailable' }, 503);
    }
    return privateJson({ error: 'completed_result_unavailable' }, 500);
  }
}

function privateJson(value: unknown, status: number): NextResponse {
  const response = NextResponse.json(value, { status });
  response.headers.set('cache-control', 'private, no-store');
  return response;
}
