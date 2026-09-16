import { NextResponse } from 'next/server';
import {
  DailyAdminWorkflowError,
  createDailyAdminWorkflow,
} from '../../../dailyAdminWorkflow';
import {
  DailyChatOpsAuthorizationError,
} from '../../../dailyChatOpsAuthorization';
import { createDailyChatOpsContext } from '../../../dailyChatOpsComposition';
import {
  DailyChatOpsRequestError,
  parseDailyChatOpsLineupRequest,
} from '../../../dailyChatOpsLineupRequest';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { actorId, repository } = createDailyChatOpsContext(
      request.headers.get('authorization'),
    );
    const input = parseDailyChatOpsLineupRequest(await request.json());
    const workflow = createDailyAdminWorkflow(repository);
    const occurredAt = new Date().toISOString();

    await workflow.ensureHorizon({
      actorId,
      occurredAt,
      startDate: input.puzzleDate,
      days: 1,
    });
    let puzzle = await workflow.replaceLineup({
      puzzleDate: input.puzzleDate,
      canonicalPlayerIds: input.canonicalPlayerIds,
      actorId,
      occurredAt,
    });
    if (input.schedule) {
      puzzle = await workflow.transitionLifecycle({
        puzzleDate: input.puzzleDate,
        action: 'schedule',
        actorId,
        occurredAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      puzzleDate: puzzle.puzzleDate,
      puzzleNumber: puzzle.puzzleNumber,
      status: puzzle.status,
      revision: puzzle.revision,
      selections: puzzle.selections.map(selection => ({
        slot: selection.slot,
        canonicalPlayerId: selection.player?.canonicalPlayerId ?? null,
        displayName: selection.player?.player.displayName ?? null,
      })),
      validation: puzzle.validation,
    }, {
      status: 200,
      headers: { 'cache-control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof DailyChatOpsAuthorizationError) {
      return response(
        error.kind === 'misconfigured'
          ? 'Daily lineup ChatOps is not configured.'
          : 'Daily lineup ChatOps credentials were not accepted.',
        error.kind === 'misconfigured' ? 503 : 401,
      );
    }
    if (error instanceof DailyChatOpsRequestError || error instanceof DailyAdminWorkflowError) {
      return response(error.message, 400);
    }
    if (error instanceof SyntaxError) {
      return response('A valid JSON request body is required.', 400);
    }
    return response(
      'Daily lineup ChatOps request was rejected. Confirm the puzzle is future and not published, then retry.',
      409,
    );
  }
}

function response(message: string, status: number): NextResponse {
  return new NextResponse(message, {
    status,
    headers: { 'cache-control': 'private, no-store' },
  });
}
