import { CustomNineHintRequestError, createServerCustomNineHintService } from '../../../../../serverCustomNineHints';
import { readCustomNineJsonBody } from '../../../../../customNineHintHttp';
import type { DailyResolutionRequest } from '../../../../../dailyRuntimeContracts';

const PRIVATE_HEADERS = { 'cache-control': 'private, no-store' } as const;
type Context = { params: Promise<{ puzzleId: string }> };

/** Custom-only, stateless resolution; never submits results or persists attempts. */
export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { puzzleId } = await context.params;
    const input = requireResolutionRequest(await readCustomNineJsonBody(request));
    const result = await createServerCustomNineHintService().resolveAtBat(puzzleId, input);
    return result === null
      ? Response.json({ error: 'not_found' }, { status: 404, headers: PRIVATE_HEADERS })
      : Response.json(result, { status: 200, headers: PRIVATE_HEADERS });
  } catch (error) {
    const invalid = error instanceof CustomNineHintRequestError;
    return Response.json(
      { error: invalid ? 'invalid_progression' : 'session_unavailable' },
      { status: invalid ? 400 : 503, headers: PRIVATE_HEADERS },
    );
  }
}

function requireResolutionRequest(value: unknown): DailyResolutionRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CustomNineHintRequestError();
  }
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body);
  const token = body.progressionToken;
  if (typeof token !== 'string' || token.length === 0 || token.length > 4096 || keys.length !== 2) {
    throw new CustomNineHintRequestError();
  }
  if (keys.includes('giveUp') && body.giveUp === true) {
    return { progressionToken: token, giveUp: true };
  }
  if (
    keys.includes('submittedPlayerId')
    && typeof body.submittedPlayerId === 'string'
    && body.submittedPlayerId.trim().length > 0
    && body.submittedPlayerId.length <= 200
  ) {
    return { progressionToken: token, submittedPlayerId: body.submittedPlayerId };
  }
  throw new CustomNineHintRequestError();
}
