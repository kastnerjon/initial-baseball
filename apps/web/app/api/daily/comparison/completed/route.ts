import {
  dailyNineComparisonDisabledResponse,
  dailyNineComparisonPrivateJson,
  isDailyNineComparisonReadApiEnabled,
  mapDailyNineComparisonRouteError,
  withDailyNineComparisonTiming,
} from '../../../../dailyNineComparisonHttp';
import {
  measureDailyNineComparisonStage,
  type DailyNineComparisonStageTimings,
} from '../../../../dailyNineComparisonTiming';

export async function GET(request: Request) {
  const startedAt = Date.now();
  const stageTimings: DailyNineComparisonStageTimings = {};

  if (!isDailyNineComparisonReadApiEnabled()) {
    return withDailyNineComparisonTiming(
      dailyNineComparisonDisabledResponse(),
      startedAt,
      'completed',
      stageTimings,
    );
  }

  const search = new URL(request.url).searchParams;
  try {
    const server = await measureDailyNineComparisonStage(
      stageTimings,
      'compose',
      () => import('../../../../serverDailyNineComparison'),
    );
    const result = await server.readDailyNineCompletedComparison({
      puzzleDate: search.get('date'),
      rulesetVersion: search.get('ruleset'),
    }, stageTimings);
    return withDailyNineComparisonTiming(
      dailyNineComparisonPrivateJson(result),
      startedAt,
      'completed',
      stageTimings,
    );
  } catch (error) {
    return withDailyNineComparisonTiming(
      mapDailyNineComparisonRouteError(error),
      startedAt,
      'completed',
      stageTimings,
    );
  }
}
