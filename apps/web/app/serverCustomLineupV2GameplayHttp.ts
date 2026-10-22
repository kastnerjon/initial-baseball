import 'server-only';
import { validateCustomLineupPuzzleId } from '@initial-baseball/daily';
import { decodeCustomNineTerminalReveal } from './customNineGameplayPayloadCodec';
import { hasUnexpectedCustomNinePostBody } from './customNineAttemptRequestBody';
import { readCustomNineJsonBody } from './customNineHintHttp';
import { CustomNineHintRequestError } from './serverCustomNineHints';
import { createServerCustomLineupV2AttemptBootstrap } from './serverCustomLineupV2AttemptBootstrap';
import { createServerCustomLineupV2AttemptHintService } from './serverCustomLineupV2AttemptHints';
import { createServerCustomLineupV2IncorrectGuessService } from './serverCustomLineupV2IncorrectGuesses';
import { createServerCustomLineupV2CompletedAdmissionService } from './serverCustomLineupV2CompletedAdmission';

const HEADERS = { 'cache-control': 'private, no-store', 'vary': 'Cookie' } as const;
type Action = 'bootstrap' | 'hint' | 'resolve' | 'submit';
type Context = { params: Promise<{ puzzleId: string }> };

export function isCustomLineupV2GameplayTransportEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED === 'true';
}
function response(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: HEADERS });
}
function tokenOnly(value: unknown): string | null {
  if (!record(value) || Object.keys(value).length !== 1) return null;
  return typeof value.progressionToken === 'string' && value.progressionToken.length > 0
    && value.progressionToken.length <= 4096 ? value.progressionToken : null;
}
function resolveBody(value: unknown): { progressionToken: string; giveUp: true }
  | { progressionToken: string; submittedPlayerId: string } | null {
  if (!record(value) || Object.keys(value).length !== 2) return null;
  const token = value.progressionToken;
  if (typeof token !== 'string' || !token || token.length > 4096) return null;
  if (value.giveUp === true) return { progressionToken: token, giveUp: true };
  if (typeof value.submittedPlayerId === 'string'
    && /^ibp_[0-9a-f]{20}$/.test(value.submittedPlayerId)) {
    return { progressionToken: token, submittedPlayerId: value.submittedPlayerId };
  }
  return null;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function serviceError(kind: string): Response {
  const status = kind === 'not_found' ? 404 : kind === 'invalid_credential' ? 403
    : kind === 'invalid_progression' ? 400 : 409;
  return response(kind, status);
}

/** Disabled by default. A private transport boundary for the already reviewed
 * v2 ledger services; no route may dispatch terminal vs nonterminal guesses
 * separately. Public activation requires its own security/release decision.
 */
export async function handleCustomLineupV2GameplayPost(
  request: Request, context: Context, action: Action,
): Promise<Response> {
  // Gate all actions before inspecting a body, cookie or contacting persistence.
  if (!isCustomLineupV2GameplayTransportEnabled()) return response('not_found', 404);
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return response('forbidden', 403);
  }
  if (new URL(request.url).search !== '') return response('invalid_request', 400);
  try {
    const { puzzleId } = await context.params;
    try { validateCustomLineupPuzzleId(puzzleId); }
    catch { return response('not_found', 404); }
    const cookie = request.headers.get('cookie');
    if (action === 'bootstrap') {
      if (await hasUnexpectedCustomNinePostBody(request)) return response('invalid_request', 400);
      const result = await createServerCustomLineupV2AttemptBootstrap()
        .bootstrap(puzzleId, cookie, request.url);
      switch (result.kind) {
        case 'not_found':
        case 'invalid_credential': return serviceError(result.kind);
        case 'preview': return Response.json({
          ...result.bootstrap, attemptMode: 'creator_preview',
        }, { headers: HEADERS });
        case 'ready': {
          const r = Response.json({
            ...result.bootstrap, attemptMode: 'reserved',
            attemptProgress: result.attemptProgress,
          }, { headers: HEADERS });
          if (result.setCookie !== null) r.headers.set('set-cookie', result.setCookie);
          return r;
        }
        case 'completed': return Response.json({
          attemptMode: 'completed', atBats: result.atBats,
          completedAtBats: result.completedAtBats,
          revision: result.revision, completedAt: result.completedAt,
        }, { headers: HEADERS });
      }
    }
    if (action === 'submit') {
      if (await hasUnexpectedCustomNinePostBody(request)) return response('invalid_request', 400);
      const result = await createServerCustomLineupV2CompletedAdmissionService()
        .admit(puzzleId, cookie);
      if (result.kind !== 'admitted') return serviceError(result.kind);
      return Response.json({ status: result.status }, {
        status: result.status === 'created' ? 201 : 200, headers: HEADERS,
      });
    }
    // Hint and resolve are JSON-only mutations. Check media type before reading a stream.
    if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
      !== 'application/json') return response('invalid_request', 400);
    const body: unknown = await readCustomNineJsonBody(request);
    if (action === 'hint') {
      const token = tokenOnly(body);
      if (token === null) return response('invalid_request', 400);
      const result = await createServerCustomLineupV2AttemptHintService()
        .reveal(puzzleId, cookie, token);
      if (result.kind !== 'revealed') return serviceError(result.kind);
      return Response.json({
        hint: result.hint, revision: result.revision,
        progressionToken: result.progressionToken,
      }, { headers: HEADERS });
    }
    const guess = resolveBody(body);
    if (guess === null) return response('invalid_request', 400);
    const result = await createServerCustomLineupV2IncorrectGuessService()
      .attempt(puzzleId, cookie, guess);
    if (result.kind !== 'incorrect' && result.kind !== 'terminal') {
      return serviceError(result.kind);
    }
    if (result.kind === 'incorrect') return Response.json({
      kind: 'incorrect', strikeCount: result.strikeCount, revision: result.revision,
      progressionToken: result.progressionToken,
    }, { headers: HEADERS });
    return Response.json({
      kind: 'terminal', result: result.result,
      reveal: decodeCustomNineTerminalReveal(result.reveal),
      progressionToken: result.progressionToken, revision: result.revision,
      completed: result.completed, hintBundle: result.hintBundle,
    }, { headers: HEADERS });
  } catch (error) {
    if (error instanceof CustomNineHintRequestError) return response('invalid_request', 400);
    // Action/status only: never log the exception, request, credentials, or clues.
    console.error(JSON.stringify({
      event: 'custom_lineup_gameplay_unavailable', action, status: 503,
    }));
    return response('session_unavailable', 503);
  }
}
