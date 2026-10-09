import { handleCustomNineHintPost } from '../../../../../customNineHintHttp';

type Context = { params: Promise<{ puzzleId: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  return handleCustomNineHintPost(request, context, 'revealHint');
}
