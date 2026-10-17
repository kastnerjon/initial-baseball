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
  const params = new URL(request.url).searchParams;
  const date = params.get('date');
  const startDate = params.get('startDate');
  const daysText = params.get('days');
  // Distinct single-date and horizon modes; reject ambiguous or extra query parameters.
  const single = date !== null && startDate === null && daysText === null
    && [...params.keys()].every(key => key === 'date') && params.getAll('date').length === 1;
  const range = date === null && startDate !== null && daysText !== null
    && [...params.keys()].every(key => key === 'startDate' || key === 'days')
    && params.getAll('startDate').length === 1 && params.getAll('days').length === 1;
  const validDate = (value: string | null): value is string => {
    if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const stamp = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
  };
  if (!((single && validDate(date))
    || (range && validDate(startDate) && /^([1-9]|[12][0-9]|3[01])$/.test(daysText!)))) {
    return Response.json({ error: 'invalid_date' }, { status: 400, headers: PRIVATE });
  }
  try {
    const reader = createSupabaseDailyEditorialCalendarOccupancyReader(
      createServerSupabaseClient(),
    );
    if (single) {
      const occupancy = await reader.getByDate(date!);
      return Response.json({ date, occupancy }, { headers: PRIVATE });
    }
    const days = Number(daysText);
    const slots = await reader.getHorizon(startDate!, days);
    return Response.json({ startDate, days, slots }, { headers: PRIVATE });
  } catch {
    // Fail closed, with no SQL details or player answer information in responses.
    return Response.json({ error: 'unavailable' }, { status: 503, headers: PRIVATE });
  }
}
