import {
  dailyNineComparisonDisabledResponse,
  dailyNineComparisonPrivateJson,
  isDailyNineComparisonReadApiEnabled,
  mapDailyNineComparisonRouteError,
} from '../../../../dailyNineComparisonHttp';

export async function GET(request: Request) {
  if (!isDailyNineComparisonReadApiEnabled()) {
    return dailyNineComparisonDisabledResponse();
  }

  const search = new URL(request.url).searchParams;
  try {
    const { readDailyNineCompletedComparison } = await import('../../../../serverDailyNineComparison');
    const result = await readDailyNineCompletedComparison({
      puzzleDate: search.get('date'),
      rulesetVersion: search.get('ruleset'),
    });
    return dailyNineComparisonPrivateJson(result);
  } catch (error) {
    return mapDailyNineComparisonRouteError(error);
  }
}
