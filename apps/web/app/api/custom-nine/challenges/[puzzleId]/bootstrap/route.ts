import { createServerCustomNineBootstrapService } from '../../../../../serverCustomNineBootstrap';

const PRIVATE_HEADERS = { 'cache-control': 'private, no-store' } as const;
type BootstrapContext = { params: Promise<{ puzzleId: string }> };

/** Session issuance only: no guessing, result write or future-batter hints. */
export async function GET(_request: Request, context: BootstrapContext): Promise<Response> {
  try {
    const { puzzleId } = await context.params;
    const bootstrap = await createServerCustomNineBootstrapService().bootstrap(puzzleId);
    return bootstrap === null
      ? Response.json({ error: 'not_found' }, { status: 404, headers: PRIVATE_HEADERS })
      : Response.json(bootstrap, { status: 200, headers: PRIVATE_HEADERS });
  } catch {
    // No Supabase or canonical errors, answer IDs, or secret details in public responses.
    return Response.json({ error: 'session_unavailable' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
