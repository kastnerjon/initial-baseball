import { parseCustomLineupTitle } from '@initial-baseball/shared';
import { NextRequest, NextResponse } from 'next/server';
import { creatorAuthClient, creatorAuthConfiguration, verifiedCreatorAccount } from '../../../serverCreatorAccountAuth';
import { createCustomLineupSelection } from '@initial-baseball/daily';
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

function isPublicCustomLineupCreationEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED === 'true'
    && isCustomLineupV2GameplayTransportEnabled(env);
}

function fail(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status, headers: HEADERS });
}

/** New unlisted issuance requires a verified account; guest gameplay stays separate.
 * OFF by default; never changes existing authenticated admin or legacy issued records.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isPublicCustomLineupCreationEnabled()) return fail('not_found', 404);
  const config = creatorAuthConfiguration(request);
  if (!config) return fail('not_found', 404);
  const url = new URL(request.url);
  if (request.headers.get('origin') !== url.origin) return fail('forbidden', 403);
  if (url.search !== ''
    || request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
      !== 'application/json') return fail('invalid_selection', 400);

  // Authenticate before body processing, quota admission or frozen-answer materialization.
  // Ownership never comes from JSON, email, an unlisted URL or a creator cookie.
  const auth = creatorAuthClient(request, config);
  const account = await verifiedCreatorAccount(auth.client);
  if (!account) return auth.finish(fail('authentication_required', 401));

  const body = await readDailyResultJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return auth.finish(fail('invalid_selection', body.error === 'payload_too_large' ? 413 : 400));
  }

  // A public/unlisted puzzle must be named even though old admin v1/v2
  // challenges can still be read and old private test issuers are compatible.
  const payload = body.value;
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)
    || Object.keys(payload).length !== 2
    || !Object.prototype.hasOwnProperty.call(payload, 'canonicalPlayerIds')
    || !Object.prototype.hasOwnProperty.call(payload, 'title')) {
    return auth.finish(fail('invalid_selection', 400));
  }
  const selected = payload as { canonicalPlayerIds: unknown; title: unknown };
  const title = parseCustomLineupTitle(selected.title);
  if (!title.ok) return auth.finish(fail('invalid_selection', 400));
  let canonicalPlayerIds: readonly string[];
  try {
    canonicalPlayerIds = createCustomLineupSelection(
      selected.canonicalPlayerIds as readonly string[],
    ).canonicalPlayerIds;
  } catch {
    return auth.finish(fail('invalid_selection', 400));
  }

  let stage: 'signing' | 'budget' | 'issuance' = 'signing';
  try {
    // Check signing configuration before reserving quota, and reserve before
    // expensive player snapshot materialization or immutable DB issuance.
    const creatorMarker = createCustomLineupV2CreatorBrowserMarker(getDailyProgressionSecret());
    stage = 'budget';
    const budget = await reservePublicCustomLineupCreation(request);
    if (!budget.allowed) {
      const response = fail('creation_limit_reached', 429);
      response.headers.set('retry-after', String(budget.retryAfterSeconds));
      return auth.finish(response);
    }

    stage = 'issuance';
    const issued = await createServerCustomLineupV2CreationService()
      .issueForAccount({ canonicalPlayerIds }, title.title, account.id);
    const response = NextResponse.json({ puzzleId: issued.puzzleId }, {
      status: 201, headers: HEADERS,
    });
    const finished = auth.finish(response);
    // Auth session refresh can rebuild Set-Cookie. Append the preview marker last
    // to preserve both cookies; the marker is not an ownership credential.
    finished.headers.append('set-cookie', creatorMarker.creatorCookie(issued.puzzleId, request.url));
    return finished;
  } catch (error) {
    if (error instanceof ServerCustomLineupV2CreationError) {
      const status = error.kind === 'invalid_selection' ? 400
        : error.kind === 'unsupported_players' ? 422 : 409;
      return auth.finish(fail(error.kind, status));
    }
    // Never log the originating address, owner capability, submitted IDs,
    // error message, stack, or any hint/answer material.
    console.error(JSON.stringify({
      event: 'custom_lineup_creation_unavailable',
      stage,
      status: 503,
    }));
    return auth.finish(fail('creation_unavailable', 503));
  }
}
