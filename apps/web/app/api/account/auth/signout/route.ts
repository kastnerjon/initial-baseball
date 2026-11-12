import { NextRequest, NextResponse } from 'next/server';
import { creatorAuthClient, creatorAuthConfiguration, creatorAuthResponse, sameOriginPost } from '../../../../serverCreatorAccountAuth';

export async function POST(request: NextRequest) {
  const config = creatorAuthConfiguration(request);
  if (!config) return creatorAuthResponse(NextResponse.json({ error: 'not_found' }, { status: 404 }));
  if (!sameOriginPost(request)) return creatorAuthResponse(NextResponse.json({ error: 'forbidden' }, { status: 403 }));
  const auth = creatorAuthClient(request, config);
  const result = await auth.client.auth.signOut().catch(() => ({ error: true }));
  return auth.finish(NextResponse.redirect(
    `${config.origin}/account${result.error ? '?status=unavailable' : ''}`, 303,
  ));
}
