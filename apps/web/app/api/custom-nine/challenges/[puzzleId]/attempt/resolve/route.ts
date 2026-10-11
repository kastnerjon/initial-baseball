import { isSameOriginDailyAdminMutation } from '../../../../../../dailyAdminRequestSecurity';
import { readCustomNineJsonBody } from '../../../../../../customNineHintHttp';
import { createServerCustomNineIncorrectGuessService } from '../../../../../../serverCustomNineIncorrectGuesses';
import { createServerCustomNineTerminalResolutionService } from '../../../../../../serverCustomNineTerminalResolve';
import type { DailyResolutionRequest } from '../../../../../../dailyRuntimeContracts';

const HEADERS = { 'cache-control': 'private, no-store' } as const;
type Context = { params: Promise<{ puzzleId: string }> };
function requireRequest(value: unknown): DailyResolutionRequest | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body);
  if (keys.length !== 2 || typeof body.progressionToken !== 'string'
    || !body.progressionToken || body.progressionToken.length > 4096) return null;
  if (keys.includes('giveUp') && body.giveUp === true) {
    return { progressionToken: body.progressionToken, giveUp: true };
  }
  if (keys.includes('submittedPlayerId') && typeof body.submittedPlayerId === 'string'
    && !!body.submittedPlayerId.trim() && body.submittedPlayerId.length <= 200) {
    return { progressionToken: body.progressionToken, submittedPlayerId: body.submittedPlayerId };
  }
  return null;
}

/** Full action dispatch: never expose the private nonterminal oracle in isolation. */
export async function POST(request: Request, context: Context): Promise<Response> {
  if (!isSameOriginDailyAdminMutation(request)) {
    return Response.json({ error: 'forbidden' }, { status: 403, headers: HEADERS });
  }
  let body: DailyResolutionRequest | null;
  try { body = requireRequest(await readCustomNineJsonBody(request)); }
  catch { body = null; }
  if (body === null) {
    return Response.json({ error: 'invalid_request' }, { status: 400, headers: HEADERS });
  }
  try {
    const { puzzleId } = await context.params;
    if (body.giveUp !== true) {
      const incorrect = await createServerCustomNineIncorrectGuessService()
        .attempt(puzzleId, request.headers.get('cookie'), body);
      if (incorrect.kind === 'incorrect') {
        return Response.json({ kind: 'incorrect', strikeCount: incorrect.strikeCount,
          progressionToken: incorrect.progressionToken, revision: incorrect.revision,
        }, { status: 200, headers: HEADERS });
      }
      if (incorrect.kind !== 'terminal_pending') return errorResponse(incorrect.kind);
    }
    const result = await createServerCustomNineTerminalResolutionService()
      .resolve(puzzleId, request.headers.get('cookie'), body);
    if (result.kind === 'terminal') {
      return Response.json({ kind: 'terminal', result: result.result, reveal: result.reveal,
        progressionToken: result.progressionToken,
        hintBundle: result.hintBundle, revision: result.revision,
      }, { status: 200, headers: HEADERS });
    }
    return errorResponse(result.kind);
  } catch {
    return Response.json({ error: 'session_unavailable' }, { status: 503, headers: HEADERS });
  }
}
function errorResponse(kind: 'not_found' | 'invalid_credential' | 'invalid_progression' | 'completed' | 'conflict') {
  const status = kind === 'not_found' ? 404
    : kind === 'invalid_credential' ? 403 : kind === 'invalid_progression' ? 400 : 409;
  return Response.json({ error: kind }, { status, headers: HEADERS });
}
