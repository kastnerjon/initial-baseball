import { DAILY_ADMIN_AUTH_CHALLENGE, DailyAdminAuthorizationError } from '../../../../dailyAdminAuthorization';
import { adminAttemptReportCsv, AdminAttemptFilterError } from '../../../../dailyAdminAttemptReport';
import { readDailyAdminAttemptReport } from '../../../../serverDailyAdminAttemptReport';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const headers = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' };
  try {
    const report = await readDailyAdminAttemptReport(request.headers.get('authorization'), new URL(request.url).searchParams);
    return new Response(adminAttemptReportCsv(report), { headers: { ...headers,
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="attempts-${report.filter.date}-${report.filter.ruleset}.csv"` } });
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'unauthorized') {
      return new Response('Admin credentials required.', { status: 401, headers: { ...headers, 'www-authenticate': DAILY_ADMIN_AUTH_CHALLENGE } });
    }
    return new Response(error instanceof AdminAttemptFilterError ? error.message : 'Private result report unavailable.', {
      status: error instanceof AdminAttemptFilterError ? 400 : 503, headers });
  }
}
