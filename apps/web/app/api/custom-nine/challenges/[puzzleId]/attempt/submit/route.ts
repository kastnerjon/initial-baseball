import { hasUnexpectedCustomNinePostBody } from '../../../../../../customNineAttemptRequestBody';
import { createServerCustomNineCompletedAdmissionService } from '../../../../../../serverCustomNineCompletedAdmission';

const HEADERS = { 'cache-control': 'private, no-store' } as const;
type Context = { params: Promise<{ puzzleId: string }> };

/**
 * Deliberately dormant until an operator enables the exact server-only flag.
 * No browser-submitted result, player identity, score or receipt is accepted.
 */
export async function POST(request: Request, context: Context): Promise<Response> {
  if (process.env.CUSTOM_NINE_RESULT_SUBMISSION_ENABLED !== 'true') {
    return Response.json({ error: 'not_found' }, { status: 404, headers: HEADERS });
  }
  // Browser POST supplies Origin; fail closed when missing or cross-origin.
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return Response.json({ error: 'forbidden' }, { status: 403, headers: HEADERS });
  }
  try {
    if (await hasUnexpectedCustomNinePostBody(request)) {
      return Response.json({ error: 'invalid_request' }, { status: 400, headers: HEADERS });
    }
    const { puzzleId } = await context.params;
    const result = await createServerCustomNineCompletedAdmissionService()
      .admit(puzzleId, request.headers.get('cookie'));
    if (result.kind === 'admitted') {
      // Do not expose server attempt UUID, scoring facts or the private answer.
      return Response.json({ status: result.status }, {
        status: result.status === 'created' ? 201 : 200, headers: HEADERS,
      });
    }
    const status = result.kind === 'not_found' ? 404
      : result.kind === 'invalid_credential' ? 403 : 409;
    return Response.json({
      error: result.kind === 'incomplete' ? 'attempt_incomplete' : result.kind,
    }, { status, headers: HEADERS });
  } catch {
    return Response.json({ error: 'submission_unavailable' }, {
      status: 503, headers: HEADERS,
    });
  }
}
