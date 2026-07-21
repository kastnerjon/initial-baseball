import { NextResponse } from 'next/server';
import {
  DAILY_ADMIN_AUTH_CHALLENGE,
  DailyAdminAuthorizationError,
} from '../../../dailyAdminAuthorization';
import { createDailyAdminContext } from '../../../dailyAdminComposition';
import { isSameOriginDailyAdminMutation } from '../../../dailyAdminRequestSecurity';
import { createDailyAdminWorkflow } from '../../../dailyAdminWorkflow';

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginDailyAdminMutation(request)) {
    return new NextResponse('Cross-origin Daily administration requests are not accepted.', {
      status: 403,
      headers: { 'cache-control': 'private, no-store' },
    });
  }

  try {
    const { actorId, repository } = createDailyAdminContext({
      authorizationHeader: request.headers.get('authorization'),
    });
    await createDailyAdminWorkflow(repository).ensureHorizon({
      actorId,
      occurredAt: new Date().toISOString(),
    });
    return NextResponse.redirect(new URL('/admin/daily', request.url), 303);
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'unauthorized') {
      return new NextResponse('Daily administration credentials are required.', {
        status: 401,
        headers: {
          'cache-control': 'private, no-store',
          'www-authenticate': DAILY_ADMIN_AUTH_CHALLENGE,
        },
      });
    }
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'misconfigured') {
      return new NextResponse('Daily administration is not configured.', {
        status: 503,
        headers: { 'cache-control': 'private, no-store' },
      });
    }
    return new NextResponse('Daily administration could not generate the horizon.', {
      status: 500,
      headers: { 'cache-control': 'private, no-store' },
    });
  }
}
