import { createServerCustomNinePublicReadService } from '../../../../serverCustomNinePublicRead';

const PRIVATE_HEADERS = { 'cache-control': 'private, no-store' } as const;

type CustomNineReadContext = { params: Promise<{ puzzleId: string }> };

/** Metadata-only discovery. Never a playable bootstrap or hint endpoint. */
export async function GET(_request: Request, context: CustomNineReadContext): Promise<Response> {
  try {
    const { puzzleId } = await context.params;
    const challenge = await createServerCustomNinePublicReadService().read(puzzleId);
    if (challenge === null) {
      return Response.json({ error: 'not_found' }, { status: 404, headers: PRIVATE_HEADERS });
    }
    return Response.json(challenge, { status: 200, headers: PRIVATE_HEADERS });
  } catch {
    // Provider/config/corrupt-row errors must never echo private identities or clues.
    return Response.json({ error: 'challenge_unavailable' }, {
      status: 503, headers: PRIVATE_HEADERS,
    });
  }
}
