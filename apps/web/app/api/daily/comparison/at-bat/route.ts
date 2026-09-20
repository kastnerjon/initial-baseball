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
    const { readDailyNineAtBatComparison } = await import('../../../../serverDailyNineComparison');
    const result = await readDailyNineAtBatComparison({
      puzzleDate: search.get('date'),
      rulesetVersion: search.get('ruleset'),
      pitchNumber: search.get('pitch'),
    });
    return dailyNineComparisonPrivateJson(result);
  } catch (error) {
    return mapDailyNineComparisonRouteError(error);
  }
}
