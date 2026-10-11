import { createServerCustomNineComparisonService } from '../../../../../../serverCustomNineComparison';

const HEADERS = {
  'cache-control': 'private, no-store',
  'vary': 'Cookie',
} as const;
type Context = { params: Promise<{ puzzleId: string }> };

/**
 * Staged competitive read, disabled until a separate public activation
 * decision. An issued challenge URL is not proof of an accepted result.
 * Only the service's signed-cookie + completed-ledger + admitted-result
 * checks authorize any private peer aggregates.
 */
export async function GET(request: Request, context: Context): Promise<Response> {
  if (process.env.CUSTOM_NINE_COMPARISON_READ_ENABLED !== 'true'
    || process.env.CUSTOM_NINE_RESULT_SUBMISSION_ENABLED !== 'true') {
    return Response.json({ error: 'not_found' }, { status: 404, headers: HEADERS });
  }

  // Browser GET requests do not always carry Origin. Reject explicitly
  // foreign origins and cross-site fetch metadata without requiring Origin.
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if ((origin !== null && origin !== new URL(request.url).origin)
    || site === 'cross-site') {
    return Response.json({ error: 'forbidden' }, { status: 403, headers: HEADERS });
  }

  // No query-selected submission ID, score, exclusions, or puzzle metadata.
  if (new URL(request.url).search.length > 0) {
    return Response.json({ error: 'invalid_request' }, { status: 400, headers: HEADERS });
  }

  try {
    const { puzzleId } = await context.params;
    const result = await createServerCustomNineComparisonService()
      .read(puzzleId, request.headers.get('cookie'));

    if (result.kind !== 'ready') {
      const status = result.kind === 'not_found' ? 404
        : result.kind === 'incomplete' ? 409 : 403;
      // Missing accepted result and a bad/creator credential use one
      // indistinguishable denial; never disclose competitor population.
      const error = result.kind === 'not_found' ? 'not_found'
        : result.kind === 'incomplete' ? 'attempt_incomplete' : 'forbidden';
      return Response.json({ error }, { status, headers: HEADERS });
    }

    // Explicit whitelist: never serialize a private service object wholesale.
    return Response.json({
      schemaVersion: 1,
      rulesetVersion: 'points-v4',
      completed: {
        completedGameCount: result.completed.completedGameCount,
        averageTotalPoints: result.completed.averageTotalPoints,
        scoreHistogram: result.completed.scoreHistogram,
      },
      atBats: result.atBats.map(row => ({
        pitchNumber: row.pitchNumber,
        resolvedAtBatCount: row.resolvedAtBatCount,
        averagePoints: row.averagePoints,
        scoreHistogram: row.scoreHistogram,
      })),
    }, { status: 200, headers: HEADERS });
  } catch {
    return Response.json({ error: 'comparison_unavailable' }, {
      status: 503, headers: HEADERS,
    });
  }
}
