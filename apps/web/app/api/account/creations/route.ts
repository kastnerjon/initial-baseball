import { NextRequest, NextResponse } from 'next/server';
import {
  creatorAuthClient, creatorAuthConfiguration, creatorAuthResponse, verifiedCreatorAccount,
} from '../../../serverCreatorAccountAuth';
import { createServerSupabaseClient } from '../../../serverSupabaseClient';
import { listVerifiedCreatorCreations } from '../../../serverCreatorCreationsRead';

const fail = (error: string, status: number) =>
  creatorAuthResponse(NextResponse.json({ error }, { status }));

/** Only the server-verified account may list its private creator metadata. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = creatorAuthConfiguration(request);
  if (!config || request.nextUrl.search !== '') return fail('not_found', 404);
  const auth = creatorAuthClient(request, config);
  const account = await verifiedCreatorAccount(auth.client);
  if (!account) return auth.finish(fail('authentication_required', 401));

  try {
    const creations = await listVerifiedCreatorCreations(createServerSupabaseClient(), account.id);
    return auth.finish(NextResponse.json({ creations }));
  } catch {
    // No DB row contents, account identity, SQL or private clues in error response/logs.
    return auth.finish(fail('creations_unavailable', 503));
  }
}
