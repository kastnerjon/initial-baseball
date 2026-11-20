import { validateIssuedDailyCalendarDate } from '@initial-baseball/daily/official-edition-identity';
import { createOfficialDailyAttemptBrowserCredential, isOfficialDailyBrowserPuzzleId } from '../../../../../../customNineAttemptBrowserCredential';
import { parseBody, readBoundedJson, respond } from '../../../../../../officialDailyEditionRequest';
import { createServerOfficialDailyCompetitiveGame } from '../../../../../../serverOfficialDailyCompetitiveGame';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ puzzleId: string; action: string }> };

export async function POST(request: Request, context: Context) {
  if (process.env.OFFICIAL_DAILY_EDITION_COMPETITIVE_HTTP_ENABLED !== 'true' ||
      process.env.OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED !== 'true') {
    return respond({ error: 'not_found' }, 404);
  }
  const { puzzleId, action } = await context.params;
  if (!isOfficialDailyBrowserPuzzleId(puzzleId) ||
      (action !== 'bootstrap' && action !== 'scorecard' && action !== 'hints' && action !== 'resolve')) {
    return respond({ error: 'not_found' }, 404);
  }
  const url = new URL(request.url);
  if (url.protocol !== 'https:' || request.headers.get('origin') !== url.origin) {
    return respond({ error: 'forbidden' }, 403);
  }
  if (url.search || request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    return respond({ error: 'invalid_request' }, 400);
  }

  let date: string | undefined;
  let play: ReturnType<typeof parseBody> | undefined;
  try {
    const body = await readBoundedJson(request);
    if (action === 'bootstrap' || action === 'scorecard') {
      if (typeof body !== 'object' || !body || Object.keys(body).join(',') !== 'date' ||
          !('date' in body) || typeof body.date !== 'string') return respond({ error: 'invalid_request' }, 400);
      validateIssuedDailyCalendarDate(body.date);
      date = body.date;
    } else {
      play = parseBody(body, action);
    }
  } catch { return respond({ error: 'invalid_request' }, 400); }

  try {
    const secret = process.env.OFFICIAL_DAILY_COMPETITIVE_SECRET?.trim();
    if (!secret || secret.length < 32) {
      return respond({ error: 'unavailable' }, 503);
    }
    const credentials = createOfficialDailyAttemptBrowserCredential(secret);
    const identity = credentials.inspect(request.headers.get('cookie'), puzzleId);
    if (identity.kind === 'absent' && action === 'bootstrap') {
      // Wait for the browser to return the cookie before allocating its first attempt.
      const response = respond({ error: 'cookie_required' }, 428);
      response.headers.set('set-cookie', credentials.issue(puzzleId, request.url).setCookie);
      return response;
    }
    if (identity.kind !== 'valid') return respond({ error: 'forbidden' }, 403);
    const game = createServerOfficialDailyCompetitiveGame(
      puzzleId, identity.browserKeyDigest, secret, action === 'bootstrap' ? 'bootstrap' : 'existing',
    );
    if (action === 'scorecard') return respond(await game.getScorecard(date!));
    if (action === 'bootstrap') return respond(await game.getBootstrap(date!));
    if (action === 'hints') return respond(await game.getHintBundle(play!.progressionToken));
    return respond(await game.resolveAtBat(play!));
  } catch { return respond({ error: 'unavailable' }, 503); }
}
