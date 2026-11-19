import { isOfficialDailyOccurrenceId, validateIssuedDailyCalendarDate } from '@initial-baseball/daily/official-edition-identity';
import type { DailyBootstrap, DailyHintBundleResponse, DailyResolutionRequest, DailyResolutionResponse } from './dailyRuntimeContracts';
import {
  OfficialDailyEditionHttpError,
  validateOfficialDailyEditionBootstrap,
  validateOfficialDailyEditionHintsResponse,
  validateOfficialDailyEditionResolutionResponse,
} from './officialDailyEditionHttpTransport';

type Fetch = (input: string, init: RequestInit) => Promise<Response>;
const MAX_TOKEN_LENGTH = 4096;

function validToken(token: string): void {
  if (typeof token !== 'string' || token.length < 1 || token.length > MAX_TOKEN_LENGTH) {
    throw new OfficialDailyEditionHttpError('invalid_request');
  }
}

async function postJson(fetcher: Fetch, path: string, body: object): Promise<Response> {
  try {
    return await fetcher(path, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new OfficialDailyEditionHttpError('unavailable');
  }
}

async function requireJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new OfficialDailyEditionHttpError(response.status === 404 ? 'not_found'
      : response.status >= 400 && response.status < 500 ? 'invalid_request' : 'unavailable');
  }
  try { return await response.json() as unknown; }
  catch { throw new OfficialDailyEditionHttpError('invalid_response'); }
}

/**
 * Default-OFF browser adapter for the separate exact-edition competitive POST path.
 * First contact can return 428 after setting an HttpOnly credential; the browser
 * must return that cookie on one bounded retry before the server reserves a start.
 *
 * Bootstrap may restore a later batter, unlike the practice bootstrap. The caller
 * must reconcile authoritative progression with its local scorecard before mounting
 * gameplay; a resumed token is not a fresh nine-at-bat UI state.
 */
export function createOfficialDailyCompetitiveHttpTransport(
  puzzleId: string, fetcher: Fetch = fetch,
) {
  if (typeof puzzleId !== 'string' || !puzzleId.startsWith('daily-ed-v1-')
      || !isOfficialDailyOccurrenceId(puzzleId.slice('daily-ed-v1-'.length))) {
    throw new OfficialDailyEditionHttpError('invalid_request');
  }
  const base = '/api/daily/editions/' + puzzleId + '/competitive/';
  return {
    async bootstrap(date: string): Promise<DailyBootstrap> {
      try { validateIssuedDailyCalendarDate(date); }
      catch { throw new OfficialDailyEditionHttpError('invalid_request'); }
      let response = await postJson(fetcher, base + 'bootstrap', { date });
      if (response.status === 428) {
        // Only the exact first-contact protocol is retryable. No implicit
        // credential rotation or indefinite retry loop on an unavailable cookie.
        let body: unknown;
        try { body = await response.json(); }
        catch { throw new OfficialDailyEditionHttpError('invalid_response'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)
          || Object.keys(body).length !== 1
          || (body as Record<string, unknown>).error !== 'cookie_required') {
          throw new OfficialDailyEditionHttpError('invalid_response');
        }
        response = await postJson(fetcher, base + 'bootstrap', { date });
        if (response.status === 428) throw new OfficialDailyEditionHttpError('unavailable');
      }
      const value = await requireJson(response);
      return validateOfficialDailyEditionBootstrap(value, puzzleId, date, true);
    },
    async hints(progressionToken: string): Promise<DailyHintBundleResponse> {
      validToken(progressionToken);
      return validateOfficialDailyEditionHintsResponse(
        await requireJson(await postJson(fetcher, base + 'hints', { progressionToken })),
      );
    },
    async resolve(request: DailyResolutionRequest): Promise<DailyResolutionResponse> {
      validToken(request.progressionToken);
      const body = request.giveUp === true
        ? { progressionToken: request.progressionToken, giveUp: true }
        : { progressionToken: request.progressionToken, submittedPlayerId: request.submittedPlayerId };
      if (body.giveUp !== true && (typeof body.submittedPlayerId !== 'string'
          || body.submittedPlayerId.length < 1 || body.submittedPlayerId.length > 100)) {
        throw new OfficialDailyEditionHttpError('invalid_request');
      }
      return validateOfficialDailyEditionResolutionResponse(
        await requireJson(await postJson(fetcher, base + 'resolve', body)),
      );
    },
  };
}
