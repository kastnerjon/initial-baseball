import { NextRequest, NextResponse } from 'next/server';
import { creatorAuthClient, creatorAuthConfiguration, creatorAuthResponse, verifiedCreatorAccount } from '../../../serverCreatorAccountAuth';

export async function GET(request: NextRequest) {
  const config = creatorAuthConfiguration(request);
  if (!config) return creatorAuthResponse(NextResponse.json({ error: 'not_found' }, { status: 404 }));
  const auth = creatorAuthClient(request, config);
  const account = await verifiedCreatorAccount(auth.client);
  return auth.finish(NextResponse.json({ accountId: account?.id ?? null }));
}
