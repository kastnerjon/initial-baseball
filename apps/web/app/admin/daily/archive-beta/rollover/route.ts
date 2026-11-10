import { requireDailyAdminPrincipal, DailyAdminAuthorizationError, DAILY_ADMIN_AUTH_CHALLENGE } from '../../../../dailyAdminAuthorization';
import { isSameOriginDailyAdminMutation } from '../../../../dailyAdminRequestSecurity';
import { requireDailyChatOpsPrincipal, DailyChatOpsAuthorizationError } from '../../../../dailyChatOpsAuthorization';
import { runArchiveBetaRollover } from '../../../../serverArchiveBetaRollover';

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginDailyAdminMutation(request)) return response({ error: 'Cross-origin request rejected.' }, 403);
  try {
    const authorization = request.headers.get('authorization');
    if (/^Bearer\s/i.test(authorization ?? '')) requireDailyChatOpsPrincipal(authorization);
    else requireDailyAdminPrincipal(authorization);
    const result = await runArchiveBetaRollover();
    const status = result.failures.length > 0 || result.remaining > 0 ? 503 : 200;
    if (status !== 200) {
      // Report bounded, already-sanitized date/kind metadata; never provider exceptions,
      // source player selections, clue material or an unbounded per-day failure list.
      const failureKinds = { 'missing-source': 0, 'immutable-conflict': 0, unavailable: 0 };
      for (const failure of result.failures) failureKinds[failure.kind] += 1;
      console.error(JSON.stringify({
        event: 'archive-rollover-incomplete',
        failed: result.failures.length,
        remaining: result.remaining,
        failureKinds,
        sampleFailures: result.failures.slice(0, 5).map(({ puzzleDate, kind }) => ({ puzzleDate, kind })),
        omittedFailures: Math.max(0, result.failures.length - 5),
      }));
    }
    return response(result, status);
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError || error instanceof DailyChatOpsAuthorizationError) {
      const status = error.kind === 'unauthorized' ? 401 : 503;
      const result = response({ error: status === 401 ? 'Administrator credentials required.' : 'Administration is not configured.' }, status);
      if (status === 401) result.headers.set('www-authenticate', DAILY_ADMIN_AUTH_CHALLENGE);
      return result;
    }
    console.error(JSON.stringify({ event: 'archive-rollover-unavailable' }));
    return response({ error: 'Archive rollover is temporarily unavailable.' }, 503);
  }
}

function response(value: unknown, status: number): Response {
  return Response.json(value, { status, headers: { 'cache-control': 'private, no-store' } });
}
