import 'server-only';
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createDailyAdminWorkflow } from './dailyAdminWorkflow';
import { createSupabaseDailyPuzzleRepository } from './supabaseDailyPuzzleRepository';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { OfficialDailyDraftError, createOfficialDailyEditorialDraft,
  findOfficialDailyEditorialDraftForRecovery, parseOfficialDailyDraftInput,
  readOfficialDailyEditorialDraftPreview, replaceOfficialDailyEditorialDraftRoster,
  scheduleOfficialDailyEditorialDraft } from './serverOfficialDailyEditorialDrafts';
import { OfficialDailyIssueError, issuePrivateOfficialDaily } from './serverOfficialDailyIssuance';

const uuid = z.uuid();
const revision = z.number().int().nonnegative().safe();
const date = z.iso.date();
const key = z.string().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const playerIds = z.array(z.string().trim().min(1).max(128)).length(9)
  .refine(ids => new Set(ids).size === 9);
const draftInput = z.strictObject({
  puzzleDate: date, editionKey: key, editionNumber: z.number().int().min(2),
  title: z.string().min(1).max(120), canonicalPlayerIds: playerIds,
});
const idInput = z.strictObject({ occurrenceId: uuid });
const revInput = z.strictObject({ occurrenceId: uuid, expectedRevision: revision });
const confirmInput = revInput.extend({ confirmed: z.literal(true) });
type ToolContent = Readonly<{ content: [{ type: 'text'; text: string }]; isError?: boolean }>;

function result(value: unknown): ToolContent {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}
async function safe(work: () => Promise<unknown>): Promise<ToolContent> {
  try { return result(await work()); }
  catch (error) {
    const kind = error instanceof OfficialDailyDraftError || error instanceof OfficialDailyIssueError
      ? error.kind : 'unavailable';
    return { content: [{ type: 'text', text: JSON.stringify({ error: kind }) }], isError: true };
  }
}

/** Injectable only for synthetic isolated tests; normal requests construct the trusted service client. */
export type OfficialDailyMcpServices = Readonly<{
  createClient: () => SupabaseClient;
  search: (client: SupabaseClient, query: string) => readonly unknown[];
}>;
export const defaultOfficialDailyMcpServices: OfficialDailyMcpServices = {
  createClient: createServerSupabaseClient,
  search: (client, query) => createDailyAdminWorkflow(
    createSupabaseDailyPuzzleRepository(client),
  ).searchPlayers(query).slice(0, 25).map(candidate => ({
    canonicalPlayerId: candidate.canonicalPlayerId,
    displayName: candidate.displayName,
    yearsPlayedDisplay: candidate.yearsPlayedDisplay,
    requiresYearDisambiguation: candidate.requiresYearDisambiguation,
    primaryPosition: candidate.primaryPosition,
    revealReady: candidate.revealReady,
  })),
};

/** Stateless: one server per authenticated request; no shared queue or stored payloads. */
export function createOfficialDailyMcpServer(
  actorId: string,
  services: OfficialDailyMcpServices = defaultOfficialDailyMcpServices,
): McpServer {
  const server = new McpServer({ name: 'initial-baseball-official-daily-editor', version: '1.0.0' });
  server.registerTool('search_official_daily_players', {
    description: 'Privately find canonical players by name. Never guess ambiguous identities.',
    inputSchema: z.strictObject({ query: z.string().trim().min(2).max(80) }),
    annotations: { readOnlyHint: true },
  }, async ({ query }) => safe(async () => ({
    results: services.search(services.createClient(), query),
  })));

  server.registerTool('create_official_daily_draft', {
    description: 'Create private future-date secondary nine-player draft; does not schedule or publish.',
    inputSchema: z.strictObject({ draft: draftInput }),
  }, async ({ draft }) => safe(async () => {
    const client = services.createClient();
    const expected = parseOfficialDailyDraftInput(draft, new Date());
    const saved = await createOfficialDailyEditorialDraft(client, draft, actorId);
    const actual = await readOfficialDailyEditorialDraftPreview(client, saved.occurrenceId);
    if (actual.status !== 'draft' || actual.revision !== saved.revision
        || actual.puzzleDate !== expected.puzzleDate || actual.title !== expected.title
        || actual.editionKey !== expected.editionKey || actual.editionNumber !== expected.editionNumber
        || actual.selections.length !== expected.selections.length
        || !actual.selections.every((item, i) => item.slot === i + 1
          && item.canonicalPlayerId === expected.selections[i]?.canonicalPlayerId))
      throw new OfficialDailyDraftError('conflict');
    return { result: saved, draft: actual };
  }));

  server.registerTool('lookup_official_daily_draft', {
    description: 'Read-only private recovery by exact future date and edition key after create response loss.',
    inputSchema: z.strictObject({ puzzleDate: date, editionKey: key }),
    annotations: { readOnlyHint: true },
  }, async ({ puzzleDate, editionKey }) => safe(async () => {
    const draft = await findOfficialDailyEditorialDraftForRecovery(
      services.createClient(), puzzleDate, editionKey);
    return draft === null ? { error: 'not_found' } : { draft };
  }));

  server.registerTool('preview_official_daily_draft', {
    description: 'Read-only authoritative exact draft roster, state and revision for explicit owner review and timeout reconciliation.',
    inputSchema: idInput, annotations: { readOnlyHint: true },
  }, async ({ occurrenceId }) => safe(async () => ({
    draft: await readOfficialDailyEditorialDraftPreview(services.createClient(), occurrenceId),
  })));

  server.registerTool('revise_official_daily_draft', {
    description: 'Replace exactly nine ordered canonical players in a draft using the exact reviewed revision; never schedule.',
    inputSchema: revInput.extend({ canonicalPlayerIds: playerIds }),
  }, async ({ occurrenceId, expectedRevision, canonicalPlayerIds }) => safe(async () => {
    const client = services.createClient();
    const saved = await replaceOfficialDailyEditorialDraftRoster(
      client, occurrenceId, expectedRevision, canonicalPlayerIds, actorId);
    const draft = await readOfficialDailyEditorialDraftPreview(client, occurrenceId);
    if (draft.status !== 'draft' || draft.revision !== saved.revision
        || draft.selections.length !== canonicalPlayerIds.length
        || !draft.selections.every((item, i) => item.slot === i + 1
          && item.canonicalPlayerId === canonicalPlayerIds[i]))
      throw new OfficialDailyDraftError('conflict');
    return { result: saved, draft };
  }));

  server.registerTool('schedule_official_daily_draft', {
    description: 'SCHEDULE ONLY after explicit owner confirmation of exact roster and revision; never issue in this step.',
    inputSchema: confirmInput,
  }, async ({ occurrenceId, expectedRevision }) => safe(async () => {
    const client = services.createClient();
    const saved = await scheduleOfficialDailyEditorialDraft(client, occurrenceId, expectedRevision, actorId);
    const draft = await readOfficialDailyEditorialDraftPreview(client, occurrenceId);
    if (draft.status !== 'scheduled' || draft.revision !== saved.revision)
      throw new OfficialDailyDraftError('conflict');
    return { result: saved, draft };
  }));

  server.registerTool('issue_official_daily_draft', {
    description: 'Publish scheduled edition only after SECOND separate explicit owner confirmation; exact revision and existing immutable SQL issuer required.',
    inputSchema: confirmInput,
    annotations: { destructiveHint: true },
  }, async ({ occurrenceId, expectedRevision }) => safe(async () => {
    if (process.env.OFFICIAL_DAILY_EDITOR_ISSUANCE_ENABLED !== 'true')
      throw new OfficialDailyIssueError('unavailable');
    return { result: await issuePrivateOfficialDaily(
      services.createClient(), occurrenceId, expectedRevision) };
  }));
  return server;
}
