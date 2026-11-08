import { handleCustomV2CompletionDisplayHttp } from '../../../../../serverCustomV2CompletionDisplayHttp';

type Context = { params: Promise<{ puzzleId: string }> };

/** Default-OFF exact-challenge scoped readback; no leaderboard/name directory. */
export async function GET(request: Request, context: Context): Promise<Response> {
  return handleCustomV2CompletionDisplayHttp(request, context, 'GET');
}

/** Default-OFF first-eligible completion choice; no user-selected result ID. */
export async function POST(request: Request, context: Context): Promise<Response> {
  return handleCustomV2CompletionDisplayHttp(request, context, 'POST');
}
