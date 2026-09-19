import {
  dailyNineComparisonNoStoreJson,
  mapDailyNineComparisonRouteError,
} from '../../../../dailyNineComparisonHttp';
import { readDailyNineCompletedComparison } from '../../../../serverDailyNineComparison';

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;

  try {
    const result = await readDailyNineCompletedComparison({
      puzzleDate: searchParams.get('date'),
      rulesetVersion: searchParams.get('ruleset'),
    });
    return dailyNineComparisonNoStoreJson(result);
  } catch (error) {
    return mapDailyNineComparisonRouteError(error);
  }
}
