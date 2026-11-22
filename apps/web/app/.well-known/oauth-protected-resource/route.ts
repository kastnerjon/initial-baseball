import { NextResponse } from 'next/server';
import { readOfficialDailyMcpConfig } from '../../officialDailyMcpAuthorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(): Promise<NextResponse> {
  if (process.env.OFFICIAL_DAILY_EDITOR_MCP_ENABLED !== 'true'
      || process.env.OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED !== 'true')
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'cache-control': 'no-store' } });
  const config = readOfficialDailyMcpConfig();
  if (!config)
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  return NextResponse.json({
    resource: config.resource,
    authorization_servers: [config.authorizationServer],
    scopes_supported: ['openid'], bearer_methods_supported: ['header'],
  }, { headers: { 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' } });
}
