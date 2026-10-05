import { NextResponse } from 'next/server';
import {
  DAILY_ADMIN_AUTH_CHALLENGE,
  DailyAdminAuthorizationError,
  requireDailyAdminPrincipal,
} from '../../../../dailyAdminAuthorization';
import { isSameOriginDailyAdminMutation } from '../../../../dailyAdminRequestSecurity';
import {
  ArchiveBetaActivationError,
  issueActivatedArchiveBetaDaily,
} from '../../../../serverArchiveBetaDailyActivation';

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginDailyAdminMutation(request)) return response('Cross-origin request rejected.', 403);
  try {
    requireDailyAdminPrincipal(request.headers.get('authorization'));
    if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) {
      return response('Submit the archive issuance form.', 415);
    }
    let data: FormData;
    try {
      data = await request.formData();
    } catch {
      return response('A valid archive issuance form is required.', 400);
    }
    const dates = data.getAll('puzzleDate');
    if (dates.length !== 1 || typeof dates[0] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dates[0])) {
      return response('A valid puzzle date is required.', 400);
    }
    const result = await issueActivatedArchiveBetaDaily(dates[0]);
    const destination = new URL('/admin/daily', request.url);
    destination.searchParams.set('betaIssued', result.puzzleDate);
    const redirect = NextResponse.redirect(destination, 303);
    redirect.headers.set('cache-control', 'private, no-store');
    return redirect;
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError) {
      if (error.kind === 'unauthorized') {
        const reply = response('Daily administration credentials are required.', 401);
        reply.headers.set('www-authenticate', DAILY_ADMIN_AUTH_CHALLENGE);
        return reply;
      }
      return response('Daily administration is not configured.', 503);
    }
    if (error instanceof ArchiveBetaActivationError) {
      if (error.kind === 'invalid-date') return response('Choose a date from the beta start through today Pacific.', 400);
      if (error.kind === 'immutable-conflict') return response('This puzzle is already frozen with different content.', 409);
      return response('Issue read-back failed. Retry to verify the existing frozen puzzle.', 503);
    }
    return response('Issuance could not be verified. Check the editorial puzzle and retry; existing issued content is never rewritten.', 503);
  }
}

function response(message: string, status: number): NextResponse {
  return new NextResponse(message, { status, headers: { 'cache-control': 'private, no-store' } });
}
