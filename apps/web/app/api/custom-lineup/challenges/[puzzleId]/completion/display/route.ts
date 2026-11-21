import { handleCustomV2CompletionDisplay } from '../../../../../../serverCustomV2CompletionDisplayHttp';

type Context = { params: Promise<{ puzzleId: string }> };

/** Double default-OFF; availability requires explicit gameplay and identity gates. */
export async function GET(request: Request, context: Context): Promise<Response> {
  return handleCustomV2CompletionDisplay(request, context, 'read');
}
export async function POST(request: Request, context: Context): Promise<Response> {
  return handleCustomV2CompletionDisplay(request, context, 'record');
}
