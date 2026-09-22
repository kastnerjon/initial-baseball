import 'server-only';

export type DailyResultWriteFailureRoute = 'at_bat' | 'completed';
export type DailyResultWriteFailureCategory =
  | 'provider_configuration'
  | 'provider_repository'
  | 'unexpected';

export function recordDailyResultWriteFailure({
  route,
  category,
  status,
}: {
  route: DailyResultWriteFailureRoute;
  category: DailyResultWriteFailureCategory;
  status: 500 | 503;
}): void {
  console.error(JSON.stringify({
    event: 'daily_result_write_failure',
    route,
    category,
    status,
  }));
}
