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
      'at-bat',
    );
  }

  const search = new URL(request.url).searchParams;
  try {
    const { readDailyNineAtBatComparison } = await import('../../../../serverDailyNineComparison');
    const result = await readDailyNineAtBatComparison({
      puzzleDate: search.get('date'),
      rulesetVersion: search.get('ruleset'),
      pitchNumber: search.get('pitch'),
    });
    return withDailyNineComparisonTiming(
      dailyNineComparisonPrivateJson(result),
      startedAt,
      'at-bat',
    );
  } catch (error) {
    return withDailyNineComparisonTiming(
      mapDailyNineComparisonRouteError(error),
      startedAt,
      'at-bat',
    );
  }
}
