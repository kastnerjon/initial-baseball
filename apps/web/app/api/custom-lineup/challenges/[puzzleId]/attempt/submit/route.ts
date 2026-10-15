import { handleCustomLineupV2GameplayPost } from '../../../../../../serverCustomLineupV2GameplayHttp';

type Context = { params: Promise<{ puzzleId: string }> };

/** Off by default: does not activate Custom v2 public gameplay. */
export async function POST(request: Request, context: Context): Promise<Response> {
  return handleCustomLineupV2GameplayPost(request, context, 'submit');
}
