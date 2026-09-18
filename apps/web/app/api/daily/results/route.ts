import { submitDailyCompletedResult } from '../../../serverDailyCompletedResults';
import {
  mapCompletedResultRouteError,
  privateCompletedResultJson,
} from './response';

export async function POST(request: Request) {
  let submission: unknown;
  try {
    submission = await request.json();
  } catch {
    return privateCompletedResultJson({ error: 'invalid_submission' }, 400);
  }

  try {
    const result = await submitDailyCompletedResult(submission);

    if (result.ok) {
      return privateCompletedResultJson(
        { status: result.status },
        result.status === 'created' ? 201 : 200,
      );
    }

    return privateCompletedResultJson(
      { error: result.error },
      result.error === 'idempotency_conflict' ? 409 : 400,
    );
  } catch (error) {
    return mapCompletedResultRouteError(error);
  }
}
