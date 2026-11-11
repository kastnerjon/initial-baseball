import { NextRequest, NextResponse } from 'next/server';
import {
  creatorAuthClient, creatorAuthConfiguration, creatorAuthResponse, verifiedCreatorAccount,
} from '../../../serverCreatorAccountAuth';
import { createServerSupabaseClient } from '../../../serverSupabaseClient';
import {
  isValidCreatorCreationsCursor, listVerifiedCreatorCreations,
} from '../../../serverCreatorCreationsRead';

const fail = (error: string, status: number) =>
  creatorAuthResponse(NextResponse.json({ error }, { status }));

/** Only the server-verified account may page through its private creator metadata. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = creatorAuthConfiguration(request);
  const keys = [...request.nextUrl.searchParams.keys()];
  const cursor = request.nextUrl.searchParams.get('cursor');
  if (!config || keys.length > 1 || (keys.length === 1
    && (keys[0] !== 'cursor' || !isValidCreatorCreationsCursor(cursor)))) {
    return fail('not_found', 404);
  }
  const auth = creatorAuthClient(request, config);
  const account = await verifiedCreatorAccount(auth.client);
  if (!account) return auth.finish(fail('authentication_required', 401));

  try {
    const page = await listVerifiedCreatorCreations(
      createServerSupabaseClient(), account.id, cursor,
    );
    return auth.finish(NextResponse.json(page));
  } catch {
    // No DB row contents, account identity, SQL or private clues in error response/logs.
    return auth.finish(fail('creations_unavailable', 503));
  }
}
