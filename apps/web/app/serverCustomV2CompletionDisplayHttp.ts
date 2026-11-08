import 'server-only';
import { validateCustomLineupPuzzleId } from '@initial-baseball/daily';
import { readDailyResultJsonBody } from './dailyResultRequestBody';
import { inspectCustomLineupV2AccountCreator } from './serverCustomLineupV2AccountCreatorExclusion';
import { createServerCustomV2CompletionDisplayService } from './serverCustomV2CompletionDisplayService';

type Context = { params: Promise<{ puzzleId: string }> };
type Method = 'GET' | 'POST';
const PRIVATE = {
  'cache-control': 'private, no-store',
  'vary': 'Cookie',
  'x-content-type-options': 'nosniff',
} as const;
const MAX_BYTES = 512;
type Finisher = (response: Response) => Response;

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: PRIVATE });
}
function isFirstParty(request: Request, method: Method): boolean {
  const origin = request.headers.get('origin');
  const exactOrigin = new URL(request.url).origin;
  const site = request.headers.get('sec-fetch-site');
  if (method === 'POST') {
    return origin === exactOrigin && site === 'same-origin';
  }
  return (site === 'same-origin' || site === 'none')
    && (origin === null || origin === exactOrigin);
}

/**
 * Separate default-OFF Custom #528 name/Anonymous transport, after authoritative
 * Custom v2 scoring admission. The independent signed attempt-cookie service
 * does NOT trust a caller-supplied result ID. Existing Custom gameplay is unchanged.
 */
export async function handleCustomV2CompletionDisplayHttp(
  request: Request, context: Context, method: Method,
): Promise<Response> {
  if (process.env.CUSTOM_V2_COMPLETION_DISPLAY_ENABLED !== 'true') {
    return json({ error: 'not_found' }, 404);
  }
  if (!isFirstParty(request, method)) return json({ error: 'forbidden' }, 403);
  if (new URL(request.url).search !== '') return json({ error: 'invalid_request' }, 400);

  if (method === 'POST' && request.headers.get('content-type')
    ?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
    return json({ error: 'invalid_request' }, 415);
  }
  let choice: unknown = undefined;
  if (method === 'POST') {
    const body = await readDailyResultJsonBody(request, MAX_BYTES);
    if (!body.ok) {
      return json({ error: 'invalid_request' },
        body.error === 'payload_too_large' ? 413 : 400);
    }
    choice = body.value;
  }

  let finish: Finisher = response => response;
  try {
    const { puzzleId } = await context.params;
    try { validateCustomLineupPuzzleId(puzzleId); }
    catch { return json({ error: 'not_found' }, 404); }
    const cookie = request.headers.get('cookie');

    // Account identity verification is independent of the browser marker.
    // It permanently tags an original guest attempt if the verified creator
    // signs in later, using the existing shared attempt lock.
    const access = await inspectCustomLineupV2AccountCreator(
      request, puzzleId, cookie, nextFinish => { finish = nextFinish; },
    );
    finish = access.finish;
    if (access.owner) return finish(json({ error: 'forbidden' }, 403));

    const service = createServerCustomV2CompletionDisplayService();
    if (method === 'GET') {
      const result = await service.read(puzzleId, cookie);
      if (result.kind === 'loaded') {
        if (result.choice === null) {
          return finish(json({ status: 'unselected' }));
        }
        return finish(json(result.choice.mode === 'anonymous'
          ? { status: 'saved', mode: 'anonymous' }
          : { status: 'saved', mode: 'named', displayName: result.choice.displayName }));
      }
      const status = result.kind === 'disabled' || result.kind === 'invalid' ? 404
        : result.kind === 'unauthorized' ? 403 : 503;
      return finish(json({ error: status === 503 ? 'display_unavailable' : 'not_found' }, status));
    }

    const result = await service.write(puzzleId, cookie, choice);
    if (result.kind === 'saved') {
      return finish(json({ status: result.status }, result.status === 'created' ? 201 : 200));
    }
    const status = result.kind === 'disabled' || result.kind === 'invalid'
      ? (result.kind === 'disabled' ? 404 : 400)
      : result.kind === 'unauthorized' ? 403
        : result.kind === 'conflict' ? 409 : 503;
    return finish(json({ error: status === 503 ? 'display_unavailable'
      : status === 409 ? 'display_already_chosen'
      : status === 400 ? 'invalid_request' : 'not_found' }, status));
  } catch {
    // No names, tokens, account claims, SQL details or cookies in diagnostics.
    return finish(json({ error: 'display_unavailable' }, 503));
  }
}
