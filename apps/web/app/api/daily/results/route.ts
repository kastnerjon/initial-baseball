import { submitDailyCompletedResult } from '../../../serverDailyCompletedResults';
import {
  completedResultPrivateJson,
  mapCompletedResultRouteError,
} from '../../../dailyCompletedResultHttp';
import { readDailyResultJsonBody } from '../../../dailyResultRequestBody';

export async function POST(request: Request) {
  const body = await readDailyResultJsonBody(request);
  if (!body.ok) {
    return completedResultPrivateJson(
      { error: 'invalid_submission' },
      body.error === 'payload_too_large' ? 413 : 400,
    );
  }

  try {
    const result = await submitDailyCompletedResult(body.value);

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
