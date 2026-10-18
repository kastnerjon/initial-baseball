import { createCustomLineupV2CreatorBrowserMarker } from '../../../customNineCreatorBrowser';
import { getDailyProgressionSecret } from '../../../dailyProgressionSecret';
import { readDailyResultJsonBody } from '../../../dailyResultRequestBody';
import { reservePublicCustomLineupCreation } from '../../../serverCustomLineupCreationBudget';
import { isCustomLineupV2GameplayTransportEnabled } from '../../../serverCustomLineupV2GameplayHttp';
import {
  createServerCustomLineupV2CreationService,
  ServerCustomLineupV2CreationError,
} from '../../../serverCustomLineupV2Creation';

const HEADERS = { 'cache-control': 'private, no-store' } as const;
const MAX_BODY_BYTES = 4096;

export function isPublicCustomLineupCreationEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED === 'true'
    && isCustomLineupV2GameplayTransportEnabled(env);
}

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: HEADERS });
}

/** No sign-in required. Unlisted, immutable issuance remains server-owned.
 * OFF by default; never alters the existing authenticated admin issuer.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isPublicCustomLineupCreationEnabled()) return fail('not_found', 404);
  const url = new URL(request.url);
  if (request.headers.get('origin') !== url.origin) return fail('forbidden', 403);
  if (url.search !== ''
    || request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
      !== 'application/json') return fail('invalid_selection', 400);

  const body = await readDailyResultJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return fail('invalid_selection', body.error === 'payload_too_large' ? 413 : 400);
  }

  try {
    // Check signing configuration before reserving quota, and reserve before
    // expensive player snapshot materialization or immutable DB issuance.
    const creatorMarker = createCustomLineupV2CreatorBrowserMarker(getDailyProgressionSecret());
    const budget = await reservePublicCustomLineupCreation(request);
    if (!budget.allowed) {
      const response = fail('creation_limit_reached', 429);
      response.headers.set('retry-after', String(budget.retryAfterSeconds));
      return response;
    }

    const issued = await createServerCustomLineupV2CreationService().issue(body.value);
    const response = Response.json({ puzzleId: issued.puzzleId }, {
      status: 201, headers: HEADERS,
    });
    response.headers.set('set-cookie', creatorMarker.creatorCookie(issued.puzzleId, request.url));
    return response;
  } catch (error) {
    if (error instanceof ServerCustomLineupV2CreationError) {
      const status = error.kind === 'invalid_selection' ? 400
        : error.kind === 'unsupported_players' ? 422 : 409;
      return fail(error.kind, status);
    }
    return fail('creation_unavailable', 503);
  }
}
