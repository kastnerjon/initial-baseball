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
      'at-bat',
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
    const result = await server.readDailyNineAtBatComparison({
      puzzleDate: search.get('date'),
      rulesetVersion: search.get('ruleset'),
      pitchNumber: search.get('pitch'),
    }, stageTimings);
    return withDailyNineComparisonTiming(
      dailyNineComparisonPrivateJson(result),
      startedAt,
      'at-bat',
      stageTimings,
    );
  } catch (error) {
    return withDailyNineComparisonTiming(
      mapDailyNineComparisonRouteError(error),
      startedAt,
      'at-bat',
      stageTimings,
    );
  }
}
