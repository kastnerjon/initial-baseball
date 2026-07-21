import { NextResponse } from 'next/server';
import {
  DAILY_ADMIN_AUTH_CHALLENGE,
  DailyAdminAuthorizationError,
  requireDailyAdminPrincipal,
} from '../../../dailyAdminAuthorization';

export function GET(request: Request): NextResponse {
  try {
    requireDailyAdminPrincipal(request.headers.get('authorization'));
    return NextResponse.redirect(new URL('/admin/daily', request.url));
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

    return new NextResponse('Daily administration is not configured.', {
      status: 503,
      headers: { 'cache-control': 'private, no-store' },
    });
  }
}
