import {
  dailyNineComparisonNoStoreJson,
  mapDailyNineComparisonRouteError,
} from '../../../../dailyNineComparisonHttp';
import { readDailyNineAtBatComparison } from '../../../../serverDailyNineComparison';

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;

  try {
    const result = await readDailyNineAtBatComparison({
      puzzleDate: searchParams.get('date'),
      rulesetVersion: searchParams.get('ruleset'),
      pitchNumber: searchParams.get('pitch'),
    });
    return dailyNineComparisonNoStoreJson(result);
  } catch (error) {
    return mapDailyNineComparisonRouteError(error);
  }
}
