import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseCustomLineupTitle } from '@initial-baseball/shared';

const TABLE = 'custom_nine_issued_challenges';
const PROJECTION = 'puzzle_id,display_title,issued_at';
const ID = /^custom-lineup-v2-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ACCOUNT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
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

/** Server-only service-role query. The projection cannot expose answers, clues or owner codes. */
export async function listVerifiedCreatorCreations(
  client: SupabaseClient, verifiedAccountId: string,
): Promise<readonly CreatorCreationListItem[]> {
  if (!ACCOUNT.test(verifiedAccountId)) throw new CreatorCreationsReadError();
  let result;
  try {
    result = await client.from(TABLE).select(PROJECTION)
      .eq('creator_account_id', verifiedAccountId)
      .eq('schema_version', 2)
      .order('issued_at', { ascending: false })
      .limit(MAX_CREATIONS_PAGE);
  } catch { throw new CreatorCreationsReadError(); }
  if (result.error || !Array.isArray(result.data)) throw new CreatorCreationsReadError();
  return result.data.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || typeof value.puzzle_id !== 'string' || !ID.test(value.puzzle_id)
      || typeof value.issued_at !== 'string' || !Number.isFinite(Date.parse(value.issued_at))) {
      throw new CreatorCreationsReadError();
    }
    const title = parseCustomLineupTitle(value.display_title);
    if (!title.ok) throw new CreatorCreationsReadError();
    return { puzzleId: value.puzzle_id, title: title.title, issuedAt: value.issued_at };
  });
}
