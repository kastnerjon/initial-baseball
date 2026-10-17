import {
  DAILY_ADMIN_AUTH_CHALLENGE,
  DailyAdminAuthorizationError,
  requireDailyAdminPrincipal,
} from '../../../dailyAdminAuthorization';
import { createServerSupabaseClient } from '../../../serverSupabaseClient';
import { createSupabaseDailyEditorialCalendarOccupancyReader }
  from '../../../supabaseDailyEditorialCalendarOccupancy';

const PRIVATE = { 'cache-control': 'private, no-store' } as const;

/** Authorized read-only occupancy. Never returns selections or full editorial rows. */
export async function GET(request: Request): Promise<Response> {
  try {
    requireDailyAdminPrincipal(request.headers.get('authorization'));
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'unauthorized') {
      return Response.json({ error: 'unauthorized' }, {
        status: 401,
        headers: { ...PRIVATE, 'www-authenticate': DAILY_ADMIN_AUTH_CHALLENGE },
      });
    }
    return Response.json({ error: 'unavailable' }, { status: 503, headers: PRIVATE });
  }
  const date = new URL(request.url).searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !Number.isFinite(Date.parse(date + 'T00:00:00Z'))
    || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) {
    return Response.json({ error: 'invalid_date' }, { status: 400, headers: PRIVATE });
  }
  try {
    const reader = createSupabaseDailyEditorialCalendarOccupancyReader(
      createServerSupabaseClient(),
    );
    const occupancy = await reader.getByDate(date);
    return Response.json({ date, occupancy }, { headers: PRIVATE });
  } catch {
    // Fail closed, with no SQL details or player answer information in responses.
    return Response.json({ error: 'unavailable' }, { status: 503, headers: PRIVATE });
  }
}
