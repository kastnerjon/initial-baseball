import { isSameOriginDailyAdminMutation } from '../../../../../../dailyAdminRequestSecurity';
import { readCustomNineJsonBody } from '../../../../../../customNineHintHttp';
import { createServerCustomNineAttemptHintService } from '../../../../../../serverCustomNineAttemptHints';

const HEADERS = { 'cache-control': 'private, no-store' } as const;
type Context = { params: Promise<{ puzzleId: string }> };
function requiredToken(value: unknown): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 1) return null;
  const token = (value as { progressionToken?: unknown }).progressionToken;
  return typeof token === 'string' && token.length > 0 && token.length <= 4096 ? token : null;
}

/** Only signed-token-authorized attempts can persist one scored hint reveal. */
export async function POST(request: Request, context: Context): Promise<Response> {
  if (!isSameOriginDailyAdminMutation(request)) {
    return Response.json({ error: 'forbidden' }, { status: 403, headers: HEADERS });
  }
  let token: string | null;
  try { token = requiredToken(await readCustomNineJsonBody(request)); }
  catch { token = null; }
  if (token === null) {
    return Response.json({ error: 'invalid_request' }, { status: 400, headers: HEADERS });
  }
  try {
    const { puzzleId } = await context.params;
    const result = await createServerCustomNineAttemptHintService()
      .reveal(puzzleId, request.headers.get('cookie'), token);
    if (result.kind === 'revealed') {
      return Response.json({
        hint: result.hint, progressionToken: result.progressionToken, revision: result.revision,
      }, { status: 200, headers: HEADERS });
    }
    const status = result.kind === 'not_found' ? 404
      : result.kind === 'invalid_credential' ? 403
        : result.kind === 'invalid_progression' ? 400 : 409;
    return Response.json({ error: result.kind }, { status, headers: HEADERS });
  } catch {
    return Response.json({ error: 'session_unavailable' }, { status: 503, headers: HEADERS });
  }
}
