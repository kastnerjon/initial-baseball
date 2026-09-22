import { submitDailyAtBatResult } from '../../../serverDailyAtBatResults';
import {
  atBatResultPrivateJson,
  mapAtBatResultRouteError,
} from '../../../dailyAtBatResultHttp';
import { readDailyResultJsonBody } from '../../../dailyResultRequestBody';

export async function POST(request: Request) {
  const body = await readDailyResultJsonBody(request);
  if (!body.ok) {
    return atBatResultPrivateJson(
      { error: 'invalid_submission' },
      body.error === 'payload_too_large' ? 413 : 400,
    );
  }

  try {
    const result = await submitDailyAtBatResult(body.value);
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
