import {
  DAILY_ADMIN_AUTH_CHALLENGE,
  DailyAdminAuthorizationError,
  requireDailyAdminPrincipal,
} from '../../../dailyAdminAuthorization';
import { isSameOriginDailyAdminMutation } from '../../../dailyAdminRequestSecurity';
import { readDailyResultJsonBody } from '../../../dailyResultRequestBody';
import {
  createServerCustomNineCreationService,
  ServerCustomNineCreationError,
} from '../../../serverCustomNineCreation';

const PRIVATE_HEADERS = { 'cache-control': 'private, no-store' } as const;
const MAX_CREATION_REQUEST_BYTES = 4096;

/**
 * Staged admin-only issuer. A public anonymous creator needs an explicit
 * abuse/rate-control decision before this write boundary is opened.
 * Neither future hints nor canonical player IDs are returned.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginDailyAdminMutation(request)) {
    return Response.json({ error: 'forbidden' }, { status: 403, headers: PRIVATE_HEADERS });
  }
  try {
    requireDailyAdminPrincipal(request.headers.get('authorization'));
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'unauthorized') {
      return Response.json({ error: 'unauthorized' }, {
        status: 401,
        headers: { ...PRIVATE_HEADERS, 'www-authenticate': DAILY_ADMIN_AUTH_CHALLENGE },
      });
    }
    return Response.json({ error: 'creation_unavailable' }, { status: 503, headers: PRIVATE_HEADERS });
  }

  const body = await readDailyResultJsonBody(request, MAX_CREATION_REQUEST_BYTES);
  if (!body.ok) {
    return Response.json({ error: 'invalid_selection' }, {
      status: body.error === 'payload_too_large' ? 413 : 400,
      headers: PRIVATE_HEADERS,
    });
  }
  try {
    const issued = await createServerCustomNineCreationService().issue(body.value);
    return Response.json(issued, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof ServerCustomNineCreationError) {
      const status = error.kind === 'invalid_selection' ? 400
        : error.kind === 'unsupported_players' ? 422 : 409;
      return Response.json({ error: error.kind }, { status, headers: PRIVATE_HEADERS });
    }
    // No answer IDs, clue values, provider details or raw errors in HTTP.
    return Response.json({ error: 'creation_unavailable' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
