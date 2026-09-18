import { submitDailyAtBatResult } from '../../../serverDailyAtBatResults';
import {
  atBatResultPrivateJson,
  mapAtBatResultRouteError,
} from '../../../dailyAtBatResultHttp';

export async function POST(request: Request) {
  let submission: unknown;
  try {
    submission = await request.json();
  } catch {
    return atBatResultPrivateJson({ error: 'invalid_submission' }, 400);
  }

  try {
    const result = await submitDailyAtBatResult(submission);
    if (result.ok) {
      return atBatResultPrivateJson(
        { status: result.status },
        result.status === 'created' ? 201 : 200,
      );
    }
    return atBatResultPrivateJson(
      { error: result.error },
      result.error === 'idempotency_conflict' ? 409 : 400,
    );
  } catch (error) {
    return mapAtBatResultRouteError(error);
  }
}
