import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseCustomLineupTitle } from '@initial-baseball/shared';

const TABLE = 'custom_nine_issued_challenges';
const PROJECTION = 'puzzle_id,display_title,issued_at';
const ID = /^custom-lineup-v2-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ACCOUNT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
export const MAX_CREATIONS_PAGE = 40;

export class CreatorCreationsReadError extends Error {
  constructor() {
    super('Creator creations unavailable.');
    this.name = 'CreatorCreationsReadError';
  }
}
export type CreatorCreationListItem = Readonly<{
  puzzleId: string;
  title: string;
  issuedAt: string;
}>;
export type CreatorCreationsPage = Readonly<{
  creations: readonly CreatorCreationListItem[];
  nextCursor: string | null;
}>;

/** A bounded, non-secret compound cursor. All reads still require a verified account. */
export function isValidCreatorCreationsCursor(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 128) return false;
  const parts = value.split('|');
  return parts.length === 2 && TIMESTAMP.test(parts[0] ?? '')
    && Number.isFinite(Date.parse(parts[0] ?? '')) && ID.test(parts[1] ?? '');
}

function readItem(value: unknown): CreatorCreationListItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CreatorCreationsReadError();
  }
  const row = value as Record<string, unknown>;
  if (typeof row.puzzle_id !== 'string' || !ID.test(row.puzzle_id)
    || typeof row.issued_at !== 'string' || !TIMESTAMP.test(row.issued_at)
    || !Number.isFinite(Date.parse(row.issued_at))) {
    throw new CreatorCreationsReadError();
  }
  const title = parseCustomLineupTitle(row.display_title);
  if (!title.ok) throw new CreatorCreationsReadError();
  return { puzzleId: row.puzzle_id, title: title.title, issuedAt: row.issued_at };
}

/** Stable keyset paging, including equal issued_at timestamps, without offset drift.
 * Only projected public-safe metadata can cross the service-role read boundary.
 */
export async function listVerifiedCreatorCreations(
  client: SupabaseClient, verifiedAccountId: string, cursor: string | null = null,
): Promise<CreatorCreationsPage> {
  if (!ACCOUNT.test(verifiedAccountId)
    || (cursor !== null && !isValidCreatorCreationsCursor(cursor))) {
    throw new CreatorCreationsReadError();
  }
  let result;
  try {
    let query = client.from(TABLE).select(PROJECTION)
      .eq('creator_account_id', verifiedAccountId).eq('schema_version', 2);
    if (cursor !== null) {
      const [issuedAt, puzzleId] = cursor.split('|');
      // Cursor validation excludes PostgREST filter metacharacters.
      query = query.or('issued_at.lt.' + issuedAt
        + ',and(issued_at.eq.' + issuedAt + ',puzzle_id.lt.' + puzzleId + ')');
    }
    result = await query.order('issued_at', { ascending: false })
      .order('puzzle_id', { ascending: false }).limit(MAX_CREATIONS_PAGE + 1);
  } catch { throw new CreatorCreationsReadError(); }
  if (result.error || !Array.isArray(result.data)
    || result.data.length > MAX_CREATIONS_PAGE + 1) throw new CreatorCreationsReadError();

  const rows = result.data.map(readItem);
  const creations = rows.slice(0, MAX_CREATIONS_PAGE);
  const last = creations[creations.length - 1];
  return {
    creations,
    nextCursor: rows.length > MAX_CREATIONS_PAGE && last
      ? last.issuedAt + '|' + last.puzzleId : null,
  };
}
