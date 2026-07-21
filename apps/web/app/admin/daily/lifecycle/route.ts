import { NextResponse } from 'next/server';
import {
  DAILY_ADMIN_AUTH_CHALLENGE,
  DailyAdminAuthorizationError,
} from '../../../dailyAdminAuthorization';
import { createDailyAdminContext } from '../../../dailyAdminComposition';
import { isSameOriginDailyAdminMutation } from '../../../dailyAdminRequestSecurity';
import {
  createDailyAdminWorkflow,
  isDailyAdminLifecycleAction,
} from '../../../dailyAdminWorkflow';

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginDailyAdminMutation(request)) {
    return response('Cross-origin Daily administration requests are not accepted.', 403);
  }

  try {
    const { actorId, repository } = createDailyAdminContext({
      authorizationHeader: request.headers.get('authorization'),
    });
    const formData = await request.formData();
    const puzzleDate = readFormValue(formData, 'puzzleDate');
    const action = readFormValue(formData, 'action');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate) || !isDailyAdminLifecycleAction(action)) {
      return response('A valid puzzle date and lifecycle action are required.', 400);
    }

    await createDailyAdminWorkflow(repository).transitionLifecycle({
      puzzleDate,
      action,
      actorId,
      occurredAt: new Date().toISOString(),
    });

    const destination = new URL('/admin/daily', request.url);
    destination.searchParams.set('lifecycle', action);
    destination.searchParams.set('puzzleDate', puzzleDate);
    return NextResponse.redirect(destination, 303);
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
      return response('Daily administration is not configured.', 503);
    }
    return response('Daily lifecycle transition was rejected. Reload the horizon and confirm the puzzle is in the required status.', 409);
  }
}

function readFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function response(message: string, status: number): NextResponse {
  return new NextResponse(message, {
    status,
    headers: { 'cache-control': 'private, no-store' },
  });
}
