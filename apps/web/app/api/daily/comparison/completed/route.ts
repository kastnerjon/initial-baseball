import {
  dailyNineComparisonDisabledResponse,
  dailyNineComparisonPrivateJson,
  isDailyNineComparisonReadApiEnabled,
  mapDailyNineComparisonRouteError,
  withDailyNineComparisonTiming,
} from '../../../../dailyNineComparisonHttp';

export async function GET(request: Request) {
  const startedAt = Date.now();

  if (!isDailyNineComparisonReadApiEnabled()) {
    return withDailyNineComparisonTiming(
      dailyNineComparisonDisabledResponse(),
      startedAt,
      'completed',
    );
  }

  const search = new URL(request.url).searchParams;
  try {
    const { readDailyNineCompletedComparison } = await import('../../../../serverDailyNineComparison');
    const result = await readDailyNineCompletedComparison({
      puzzleDate: search.get('date'),
      rulesetVersion: search.get('ruleset'),
    });
    return withDailyNineComparisonTiming(
      dailyNineComparisonPrivateJson(result),
      startedAt,
      'completed',
    );
  } catch (error) {
    return withDailyNineComparisonTiming(
      mapDailyNineComparisonRouteError(error),
      startedAt,
      'completed',
    );
  }
}
