import 'server-only';
import { validateCustomLineupPuzzleId } from '@initial-baseball/daily';
import { readCustomNineJsonBody } from './customNineHintHttp';
import { CustomNineHintRequestError } from './serverCustomNineHints';
import { inspectCustomLineupV2AccountCreator } from './serverCustomLineupV2AccountCreatorExclusion';
import { createServerCustomV2CompletionDisplayService } from './serverCustomV2CompletionDisplay';
import { createServerCustomV2CompletionDisplayReadService } from './serverCustomV2CompletionDisplayRead';

const HEADERS = {
  'cache-control': 'private, no-store',
  vary: 'Cookie',
  'x-content-type-options': 'nosniff',
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
} as const;
type Context = { params: Promise<{ puzzleId: string }> };
type Action = 'read' | 'record';
type ReadResult = Awaited<ReturnType<ReturnType<
  typeof createServerCustomV2CompletionDisplayReadService>['read']>>;
type WriteResult = Awaited<ReturnType<ReturnType<
  typeof createServerCustomV2CompletionDisplayService>['record']>>;

export function isCustomV2CompletionDisplayHttpEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED === 'true'
    && env.CUSTOM_V2_COMPLETION_DISPLAY_ENABLED === 'true';
}
function response(kind: string, status: number): Response {
  return Response.json({ error: kind }, { status, headers: HEADERS });
}
function resultError(kind: string): Response {
  return response(kind, kind === 'not_found' || kind === 'disabled' ? 404
    : kind === 'invalid_credential' ? 403 : 400);
}
function readResponse(result: ReadResult): Response {
  if (result.kind === 'found') {
    return Response.json({
      status: 'saved', mode: result.display.mode, displayName: result.display.displayName,
    }, { status: 200, headers: HEADERS });
  }
  if (result.kind === 'not_set') {
    return Response.json({ status: 'not_set' }, { status: 200, headers: HEADERS });
  }
  return resultError(result.kind);
}
function writeResponse(result: WriteResult): Response {
  if (result.kind === 'saved') {
    return Response.json({ status: result.status }, {
      status: result.status === 'created' ? 201 : 200, headers: HEADERS,
    });
  }
  return resultError(result.kind);
}

/** Double-gated HTTP transport for already-admitted Custom v2 guest displays.
 * No independent score admission, nickname ownership, or public results.
 */
export async function handleCustomV2CompletionDisplay(
  request: Request, context: Context, action: Action,
): Promise<Response> {
  // Gate before body, cookie, session verification or privileged database access.
  if (!isCustomV2CompletionDisplayHttpEnabled()) return response('not_found', 404);
  const origin = new URL(request.url).origin;
  const givenOrigin = request.headers.get('origin');
  if ((action === 'record' && givenOrigin !== origin)
    || (action === 'read' && givenOrigin !== null && givenOrigin !== origin)) {
    return response('forbidden', 403);
  }
  if (new URL(request.url).search !== '') return response('invalid_request', 400);
  if (action === 'record' && request.headers.get('content-type')?.split(';', 1)[0]
    ?.trim().toLowerCase() !== 'application/json') return response('invalid_request', 400);

  let finish: (result: Response) => Response = result => result;
  try {
    const { puzzleId } = await context.params;
    try { validateCustomLineupPuzzleId(puzzleId); }
    catch { return response('not_found', 404); }

    const payload: unknown = action === 'record' ? await readCustomNineJsonBody(request) : null;
    const cookie = request.headers.get('cookie');
    const access = await inspectCustomLineupV2AccountCreator(
      request, puzzleId, cookie, nextFinish => { finish = nextFinish; },
    );
    finish = access.finish;
    if (access.owner) return finish(response('invalid_credential', 403));
    if (action === 'read') {
      const result = await createServerCustomV2CompletionDisplayReadService()
        .read(puzzleId, cookie);
      return finish(readResponse(result));
    }
    const result = await createServerCustomV2CompletionDisplayService()
      .record(puzzleId, cookie, payload);
    return finish(writeResponse(result));
  } catch (error) {
    if (error instanceof CustomNineHintRequestError) {
      return finish(response('invalid_request', 400));
    }
    // No raw error, cookie, player name, SQL, score or private account data in logs.
    console.error(JSON.stringify({
      event: 'custom_v2_completion_display_unavailable', action, status: 503,
    }));
    return finish(response('session_unavailable', 503));
  }
}
