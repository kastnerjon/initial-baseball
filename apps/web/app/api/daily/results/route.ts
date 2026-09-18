import { NextResponse } from 'next/server';
import {
  completedResultPrivateJson,
  mapCompletedResultRouteError,
} from '../../../dailyCompletedResultHttp';
import { submitDailyCompletedResult } from '../../../serverDailyCompletedResults';

export async function POST(request: Request): Promise<NextResponse> {
  let submission: unknown;
  try {
    submission = await request.json();
  } catch {
    return completedResultPrivateJson({ error: 'invalid_submission' }, 400);
  }

  try {
    const result = await submitDailyCompletedResult(submission);

    if (result.ok) {
      return completedResultPrivateJson(
        { status: result.status },
        result.status === 'created' ? 201 : 200,
      );
    }

    return completedResultPrivateJson(
      { error: result.error },
      result.error === 'idempotency_conflict' ? 409 : 400,
    );
  } catch (error) {
    return mapCompletedResultRouteError(error);
  }
}

