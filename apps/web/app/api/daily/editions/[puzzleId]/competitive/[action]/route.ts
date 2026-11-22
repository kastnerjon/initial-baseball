import { validateIssuedDailyCalendarDate } from '@initial-baseball/daily/official-edition-identity';
import { createOfficialDailyAttemptBrowserCredential, isOfficialDailyBrowserPuzzleId } from '../../../../../../customNineAttemptBrowserCredential';
import { parseBody, readBoundedJson, respond } from '../../../../../../officialDailyEditionRequest';
import { createServerOfficialDailyCompetitiveGame } from '../../../../../../serverOfficialDailyCompetitiveGame';
import { readOfficialDailyCompetitiveSigningKeys } from '../../../../../../officialDailyCompetitiveSigningKeys';
import { isOfficialDailyEditionCompetitiveVisible } from '../../../../../../serverOfficialDailyEditionChoice';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ puzzleId: string; action: string }> };

export async function POST(request: Request, context: Context) {
  if (!isOfficialDailyEditionCompetitiveVisible()) {
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
    const { active, legacy } = readOfficialDailyCompetitiveSigningKeys();
    const credentials = createOfficialDailyAttemptBrowserCredential(active, legacy);
    const identity = credentials.inspect(request.headers.get('cookie'), puzzleId, request.url);
    if (identity.kind === 'absent' && action === 'bootstrap') {
      // Wait for the browser to return the cookie before allocating its first attempt.
      const response = respond({ error: 'cookie_required' }, 428);
      response.headers.set('set-cookie', credentials.issue(puzzleId, request.url).setCookie);
      return response;
    }
    if (identity.kind !== 'valid') return respond({ error: 'forbidden' }, 403);
    const game = createServerOfficialDailyCompetitiveGame(
      puzzleId, identity.browserKeyDigest, active,
      action === 'bootstrap' ? 'bootstrap' : 'existing', legacy,
    );
    const response = action === 'scorecard' ? respond(await game.getScorecard(date!))
      : action === 'bootstrap' ? respond(await game.getBootstrap(date!))
      : action === 'hints' ? respond(await game.getHintBundle(play!.progressionToken))
      : respond(await game.resolveAtBat(play!));
    if (identity.replacementSetCookie) {
      response.headers.set('set-cookie', identity.replacementSetCookie);
    }
    return response;
  } catch { return respond({ error: 'unavailable' }, 503); }
}
