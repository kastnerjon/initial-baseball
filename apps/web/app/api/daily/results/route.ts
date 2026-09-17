import { NextResponse } from 'next/server';
import { DailyRuntimeRequestError } from '../../../dailyRuntimeService';
import { submitDailyCompletedResult } from '../../../serverDailyCompletedResults';

export async function POST(request: Request): Promise<NextResponse> {
  let submission: unknown;
  try {
    submission = await request.json();
  } catch {
    return privateJson({ error: 'invalid_submission' }, { status: 400 });
  }

  try {
    const result = await submitDailyCompletedResult(submission);
    if (result.ok) {
      return privateJson(
        { status: result.status },
        { status: result.status === 'created' ? 201 : 200 },
      );
    }
    return privateJson(
      { error: result.error },
      { status: result.error === 'idempotency_conflict' ? 409 : 400 },
    );
  } catch (error) {
    if (error instanceof DailyRuntimeRequestError) {
      return privateJson({ error: 'invalid_puzzle' }, { status: 400 });
    }
    return privateJson({ error: 'completed_result_unavailable' }, { status: 500 });
  }
}

function privateJson(value: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(value, init);
  response.headers.set('cache-control', 'private, no-store');
  return response;
}
