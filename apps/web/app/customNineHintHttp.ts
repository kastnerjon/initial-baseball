import 'server-only';
import {
  CustomNineHintRequestError,
  createServerCustomNineHintService,
} from './serverCustomNineHints';

const PRIVATE_HEADERS = { 'cache-control': 'private, no-store' } as const;
const MAX_REQUEST_BYTES = 4096;
type Context = { params: Promise<{ puzzleId: string }> };

export async function handleCustomNineHintPost(
  request: Request,
  context: Context,
  action: 'getHintBundle' | 'revealHint',
): Promise<Response> {
  try {
    const { puzzleId } = await context.params;
    const token = requireProgressionToken(await readCustomNineJsonBody(request));
    const result = await createServerCustomNineHintService()[action](puzzleId, token);
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

export async function readCustomNineJsonBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new CustomNineHintRequestError();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) throw new CustomNineHintRequestError();
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    throw new CustomNineHintRequestError();
  } finally {
    reader.releaseLock();
  }
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new CustomNineHintRequestError(); }
  return body;
}

function requireProgressionToken(body: unknown): string {
  if (
    !body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).length !== 1
    || typeof (body as { progressionToken?: unknown }).progressionToken !== 'string'
  ) throw new CustomNineHintRequestError();
  return (body as { progressionToken: string }).progressionToken;
}
