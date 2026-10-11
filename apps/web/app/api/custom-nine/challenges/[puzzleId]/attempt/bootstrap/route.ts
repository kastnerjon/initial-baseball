import { isSameOriginDailyAdminMutation } from '../../../../../../dailyAdminRequestSecurity';
import { createServerCustomNineAttemptBootstrap } from '../../../../../../serverCustomNineAttemptBootstrap';

const HEADERS = { 'cache-control': 'private, no-store' } as const;
type Context = { params: Promise<{ puzzleId: string }> };

/** Explicit opt-in attempt reservation. Existing read-only GET is unchanged. */
export async function POST(request: Request, context: Context): Promise<Response> {
  if (!isSameOriginDailyAdminMutation(request)) {
    return Response.json({ error: 'forbidden' }, { status: 403, headers: HEADERS });
  }
  try {
    // Next.js may give a bodyless POST a non-null but empty ReadableStream.
    // Inspect a bounded number of chunks; reject nonempty bodies, not streams.
    if (await hasUnexpectedBody(request)) {
      return Response.json({ error: 'invalid_request' }, { status: 400, headers: HEADERS });
    }
    const { puzzleId } = await context.params;
    const result = await createServerCustomNineAttemptBootstrap()
      .bootstrap(puzzleId, request.headers.get('cookie'), request.url);
    switch (result.kind) {
      case 'not_found':
        return Response.json({ error: 'not_found' }, { status: 404, headers: HEADERS });
      case 'invalid_credential':
        return Response.json({ error: 'invalid_credential' }, { status: 403, headers: HEADERS });
      case 'completed':
        return Response.json({ error: 'attempt_completed' }, { status: 409, headers: HEADERS });
      case 'preview':
        return Response.json({ ...result.bootstrap, attemptMode: 'creator_preview' }, {
          status: 200, headers: HEADERS,
        });
      case 'ready': {
        const response = Response.json({ ...result.bootstrap, attemptMode: 'reserved' }, {
          status: 200, headers: HEADERS,
        });
        if (result.setCookie !== null) response.headers.set('set-cookie', result.setCookie);
        return response;
      }
    }
  } catch {
    // Includes corrupted stored tokens, signing config and provider faults.
    return Response.json({ error: 'attempt_unavailable' }, { status: 503, headers: HEADERS });
  }
}

async function hasUnexpectedBody(request: Request): Promise<boolean> {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null && contentLength !== '0') return true;
  if (request.body === null) return false;
  const reader = request.body.getReader();
  try {
    for (let chunk = 0; chunk < 8; chunk++) {
      const { done, value } = await reader.read();
      if (done) return false;
      if (value.byteLength > 0) return true;
    }
    // Malformed endless sequence of empty chunks: fail closed.
    return true;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
