import { NextResponse } from 'next/server';
import { isOfficialDailyOccurrenceId } from '@initial-baseball/daily';
import { DailyChatOpsAuthorizationError, requireDailyChatOpsPrincipal } from '../../../../dailyChatOpsAuthorization';
import { isSameOriginDailyAdminMutation } from '../../../../dailyAdminRequestSecurity';
import { readDailyResultJsonBody } from '../../../../dailyResultRequestBody';
import { createServerSupabaseClient } from '../../../../serverSupabaseClient';
import {
  createOfficialDailyEditorialDraft, findOfficialDailyEditorialDraftForRecovery, OfficialDailyDraftError, parseOfficialDailyDraftInput,
  readOfficialDailyEditorialDraftPreview, replaceOfficialDailyEditorialDraftRoster, scheduleOfficialDailyEditorialDraft,
} from '../../../../serverOfficialDailyEditorialDrafts';
import { issuePrivateOfficialDaily, OfficialDailyIssueError } from '../../../../serverOfficialDailyIssuance';

const HEADERS = { 'cache-control': 'private, no-store', vary: 'Authorization' } as const;
const reply = (status: number, error: string) => NextResponse.json({ error }, { status, headers: HEADERS });
const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const keysEqual = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));

/** Bearer-only private ChatOps; all future roster content stays in this response. */
export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.OFFICIAL_DAILY_EDITOR_CHATOPS_ENABLED !== 'true'
      || process.env.OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED !== 'true') return reply(404, 'not_found');
  const site = request.headers.get('sec-fetch-site');
  if (!isSameOriginDailyAdminMutation(request) || (site !== null && site !== 'same-origin' && site !== 'none')) {
    return reply(403, 'forbidden');
  }
  const url = new URL(request.url);
  if (url.search !== '' || request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
    return reply(400, 'invalid_request');
  }
  let actorId: string;
  try { actorId = requireDailyChatOpsPrincipal(request.headers.get('authorization')).actorId; }
  catch (error) {
    return reply(error instanceof DailyChatOpsAuthorizationError && error.kind === 'unauthorized' ? 401 : 503,
      error instanceof DailyChatOpsAuthorizationError && error.kind === 'unauthorized' ? 'unauthorized' : 'unavailable');
  }
  const parsed = await readDailyResultJsonBody(request, 8192);
  if (!parsed.ok) return reply(parsed.error === 'payload_too_large' ? 413 : 400, 'invalid_request');
  const v = parsed.value;
  if (!isRecord(v) || typeof v.action !== 'string') return reply(400, 'invalid_request');
  const create = v.action === 'create' && keysEqual(v, ['action', 'draft']) && isRecord(v.draft);
  const preview = v.action === 'preview' && keysEqual(v, ['action', 'occurrenceId']);
  const lookup = v.action === 'lookup' && keysEqual(v, ['action', 'puzzleDate', 'editionKey'])
    && typeof v.puzzleDate === 'string' && typeof v.editionKey === 'string';
  const schedule = v.action === 'schedule' && keysEqual(v, ['action', 'occurrenceId', 'expectedRevision', 'confirmed'])
    && v.confirmed === true && Number.isSafeInteger(v.expectedRevision) && (v.expectedRevision as number) >= 0;
  const revise = v.action === 'revise' && keysEqual(v, ['action', 'occurrenceId', 'expectedRevision', 'canonicalPlayerIds'])
    && Number.isSafeInteger(v.expectedRevision) && (v.expectedRevision as number) >= 0 && Array.isArray(v.canonicalPlayerIds);
  const issue = v.action === 'issue' && keysEqual(v, ['action', 'occurrenceId', 'expectedRevision', 'confirmed'])
    && v.confirmed === true && Number.isSafeInteger(v.expectedRevision) && (v.expectedRevision as number) >= 0;
  if (!create && !preview && !lookup && !schedule && !revise && !issue) return reply(400, 'invalid_request');
  if (issue && process.env.OFFICIAL_DAILY_EDITOR_ISSUANCE_ENABLED !== 'true') return reply(404, 'not_found');
  if (!create && !lookup && (typeof v.occurrenceId !== 'string' || !isOfficialDailyOccurrenceId(v.occurrenceId))) return reply(400, 'invalid_request');
  try {
    const expected = create ? parseOfficialDailyDraftInput(v.draft, new Date()) : null;
    const client = createServerSupabaseClient();
    if (lookup) {
      const draft = await findOfficialDailyEditorialDraftForRecovery(client, v.puzzleDate, v.editionKey);
      if (draft === null) return reply(404, 'not_found');
      return NextResponse.json({ draft }, { status: 200, headers: HEADERS });
    }
    if (create) {
      const result = await createOfficialDailyEditorialDraft(client, v.draft, actorId);
      const draft = await readOfficialDailyEditorialDraftPreview(client, result.occurrenceId);
      if (!expected || draft.occurrenceId !== result.occurrenceId || draft.status !== 'draft'
          || draft.revision !== result.revision || draft.puzzleDate !== expected.puzzleDate
          || draft.puzzleNumber !== expected.puzzleNumber
          || draft.editionKey !== expected.editionKey || draft.editionNumber !== expected.editionNumber
          || draft.title !== expected.title || draft.selections.length !== expected.selections.length
          || !draft.selections.every((selection, i) => selection.slot === expected.selections[i]?.slot
            && selection.canonicalPlayerId === expected.selections[i]?.canonicalPlayerId)) return reply(409, 'conflict');
      return NextResponse.json({ result, draft }, { status: result.status === 'created' ? 201 : 200, headers: HEADERS });
    }
    if (preview) {
      const draft = await readOfficialDailyEditorialDraftPreview(client, v.occurrenceId as string);
      return NextResponse.json({ draft }, { status: 200, headers: HEADERS });
    }
    if (revise) {
      const result = await replaceOfficialDailyEditorialDraftRoster(
        client, v.occurrenceId as string, v.expectedRevision as number, v.canonicalPlayerIds, actorId);
      const draft = await readOfficialDailyEditorialDraftPreview(client, result.occurrenceId);
      const ids = v.canonicalPlayerIds as unknown[];
      if (draft.occurrenceId !== result.occurrenceId || draft.status !== 'draft'
          || draft.revision !== result.revision || draft.selections.length !== ids.length
          || !draft.selections.every((selection, i) => selection.slot === i + 1
            && selection.canonicalPlayerId === ids[i])) return reply(409, 'conflict');
      return NextResponse.json({ result, draft }, { status: 200, headers: HEADERS });
    }
    if (issue) {
      // Issuance requires a second explicit confirmation. The existing issuer
      // verifies the atomic SQL winner and frozen publication readback.
      const result = await issuePrivateOfficialDaily(client, v.occurrenceId as string, v.expectedRevision as number);
      return NextResponse.json({ result }, { status: result.status === 'created' ? 201 : 200, headers: HEADERS });
    }
    const result = await scheduleOfficialDailyEditorialDraft(client, v.occurrenceId as string, v.expectedRevision as number, actorId);
    const draft = await readOfficialDailyEditorialDraftPreview(client, result.occurrenceId);
    if (draft.occurrenceId !== result.occurrenceId || draft.status !== 'scheduled' || draft.revision !== result.revision) return reply(409, 'conflict');
    return NextResponse.json({ result, draft }, { status: 200, headers: HEADERS });
  } catch (error) {
    if (error instanceof OfficialDailyDraftError || error instanceof OfficialDailyIssueError) {
      return reply(error.kind === 'invalid' ? 400 : error.kind === 'conflict' ? 409 : 503, error.kind);
    }
    return reply(503, 'unavailable');
  }
}
