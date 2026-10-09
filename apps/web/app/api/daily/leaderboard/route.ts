import { readDailyResultJsonBody } from '../../../dailyResultRequestBody';
import { getDailyNineLeaderboardService } from '../../../serverDailyNineLeaderboard';

const HEADERS = { 'cache-control': 'private, no-store' } as const;

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams;
  const number = query.get('number');
  return respond(() => getDailyNineLeaderboardService().read({
    puzzleId: query.get('puzzleId'),
    puzzleDate: query.get('date'),
    puzzleNumber: number !== null && /^\d+$/.test(number) ? Number(number) : null,
    rulesetVersion: query.get('ruleset'),
  }));
}

export async function POST(request: Request): Promise<Response> {
  const body = await readDailyResultJsonBody(request, 2 * 1024);
  if (!body.ok) return Response.json({ error: 'invalid_request' }, {
    status: body.error === 'payload_too_large' ? 413 : 400, headers: HEADERS,
  });
  const input = body.value;
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return Response.json({ error: 'invalid_request' }, { status: 400, headers: HEADERS });
  }
  const payload = input as Record<string, unknown>;
  if (payload.action === 'submit') return respond(() => getDailyNineLeaderboardService().submit(payload));
  if (payload.action === 'rank') return respond(() => getDailyNineLeaderboardService().rank(payload));
  return Response.json({ error: 'invalid_request' }, { status: 400, headers: HEADERS });
}

async function respond(
  call: () => Promise<{ ok: true; value: unknown } | { ok: false; error: string }>,
): Promise<Response> {
  try {
    const result = await call();
    if (result.ok) return Response.json(result.value, { status: 200, headers: HEADERS });
    const status = result.error === 'name_conflict' ? 409
      : result.error === 'not_eligible' ? 404 : 400;
    return Response.json({ error: result.error }, { status, headers: HEADERS });
  } catch {
    return Response.json({ error: 'leaderboard_unavailable' }, { status: 503, headers: HEADERS });
  }
}
