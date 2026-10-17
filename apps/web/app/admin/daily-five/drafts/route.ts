import { randomUUID } from 'node:crypto';
import { createProspectiveDailyFiveEditorialDraft, getDailyPuzzleNumber } from '@initial-baseball/daily';
import {
  DAILY_ADMIN_AUTH_CHALLENGE, DailyAdminAuthorizationError, requireDailyAdminPrincipal,
} from '../../../dailyAdminAuthorization';
import { isSameOriginDailyAdminMutation } from '../../../dailyAdminRequestSecurity';
import { readDailyResultJsonBody } from '../../../dailyResultRequestBody';
import { createServerSupabaseClient } from '../../../serverSupabaseClient';
import {
  SupabaseDailyPuzzleRepositoryError,
} from '../../../supabaseDailyPuzzleRowCodec';
import { createSupabaseProspectiveDailyFiveDraftRepository } from '../../../supabaseProspectiveDailyFiveDraftRepository';

const PRIVATE = { 'cache-control': 'private, no-store' } as const;
const MAX_BYTES = 4096;

/** No public/normal Daily path calls this route. Default-off guard protects v1 calendar. */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginDailyAdminMutation(request)) {
    return Response.json({ error: 'forbidden' }, { status: 403, headers: PRIVATE });
  }
  let actorId: string;
  try {
    actorId = requireDailyAdminPrincipal(request.headers.get('authorization')).actorId;
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'unauthorized') {
      return Response.json({ error: 'unauthorized' }, {
        status: 401, headers: { ...PRIVATE, 'www-authenticate': DAILY_ADMIN_AUTH_CHALLENGE },
      });
    }
    return Response.json({ error: 'unavailable' }, { status: 503, headers: PRIVATE });
  }
  // Do not activate until legacy nine-player generation and publication have a safe cutover.
  if (process.env.DAILY_FIVE_DRAFT_WRITES_ENABLED !== 'true') {
    return Response.json({ error: 'draft_writes_not_enabled' }, {
      status: 409, headers: PRIVATE,
    });
  }

  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') ?? '')) {
    return Response.json({ error: 'invalid_draft' }, { status: 415, headers: PRIVATE });
  }
  const body = await readDailyResultJsonBody(request, MAX_BYTES);
  if (!body.ok) return Response.json({ error: 'invalid_draft' }, {
    status: body.error === 'payload_too_large' ? 413 : 400, headers: PRIVATE,
  });

  const value = body.value;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return Response.json({ error: 'invalid_draft' }, { status: 400, headers: PRIVATE });
  }
  const input = value as Record<string, unknown>;
  if (typeof input.puzzleDate !== 'string' || !Array.isArray(input.canonicalPlayerIds)
    || input.canonicalPlayerIds.length !== 5
    || !input.canonicalPlayerIds.every(id => typeof id === 'string')) {
    return Response.json({ error: 'invalid_draft' }, { status: 400, headers: PRIVATE });
  }
  try {
    const draft = createProspectiveDailyFiveEditorialDraft({
      id: 'daily-five-draft-' + randomUUID(),
      puzzleDate: input.puzzleDate,
      puzzleNumber: getDailyPuzzleNumber(input.puzzleDate),
      selections: (input.canonicalPlayerIds as string[]).map((canonicalPlayerId, index) => ({
        slot: index + 1, canonicalPlayerId, source: 'manual',
      })),
      actorId, occurredAt: new Date().toISOString(),
    });
    const persisted = await createSupabaseProspectiveDailyFiveDraftRepository(
      createServerSupabaseClient(),
    ).insertDraft(draft);
    return Response.json({ draftId: persisted.id, puzzleDate: persisted.puzzleDate }, {
      status: 201, headers: PRIVATE,
    });
  } catch (error) {
    if (error instanceof SupabaseDailyPuzzleRepositoryError && error.kind === 'conflict') {
      return Response.json({ error: 'date_conflict' }, { status: 409, headers: PRIVATE });
    }
    if (error instanceof Error && /Daily|player|selection|canonical|date|slot|actor|puzzle/i.test(error.message)
      && !(error instanceof SupabaseDailyPuzzleRepositoryError)) {
      return Response.json({ error: 'invalid_draft' }, { status: 400, headers: PRIVATE });
    }
    return Response.json({ error: 'unavailable' }, { status: 503, headers: PRIVATE });
  }
}
