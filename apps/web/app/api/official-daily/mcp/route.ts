import { createMcpHandler } from '@modelcontextprotocol/server';
import { NextResponse } from 'next/server';
import { isOfficialDailyMcpRequestOrigin, officialDailyMcpChallenge,
  readOfficialDailyMcpConfig, verifyOfficialDailyMcpBearer } from '../../../officialDailyMcpAuthorization';
import { createOfficialDailyMcpServer } from '../../../officialDailyMcpTools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const HEADERS = {
  'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer', vary: 'Authorization',
};
const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: HEADERS });

export async function POST(request: Request): Promise<Response> {
  if (process.env.OFFICIAL_DAILY_EDITOR_MCP_ENABLED !== 'true'
      || process.env.OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED !== 'true') return fail(404, 'not_found');
  const config = readOfficialDailyMcpConfig();
  if (!config) return fail(503, 'unavailable');
  if (!isOfficialDailyMcpRequestOrigin(request, config)) return fail(403, 'forbidden');
  if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
      !== 'application/json') return fail(415, 'invalid_request');
  const principal = await verifyOfficialDailyMcpBearer(request.headers.get('authorization'), config);
  if (!principal) {
    const response = fail(401, 'unauthorized');
    response.headers.set('www-authenticate', officialDailyMcpChallenge(config));
    return response;
  }
  const handler = createMcpHandler(() => createOfficialDailyMcpServer(principal.actorId), {
    responseMode: 'json', maxRequestBodySize: 8192,
  });
  try {
    const response = await handler.fetch(request, {
      authInfo: { token: '', clientId: principal.clientId, scopes: ['openid'],
        expiresAt: principal.expiresAt },
    });
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(HEADERS)) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  } catch { return fail(503, 'unavailable'); }
}
function disabled(): boolean {
  return process.env.OFFICIAL_DAILY_EDITOR_MCP_ENABLED !== 'true'
    || process.env.OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED !== 'true';
}
export async function GET(): Promise<Response> {
  return disabled() ? fail(404, 'not_found') : fail(405, 'method_not_allowed');
}
export async function DELETE(): Promise<Response> {
  return disabled() ? fail(404, 'not_found') : fail(405, 'method_not_allowed');
}
