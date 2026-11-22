import 'server-only';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyResult } from 'jose';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENDPOINT = '/api/official-daily/mcp';

export type OfficialDailyMcpConfig = Readonly<{
  resource: string;
  authorizationServer: string;
  issuer: string;
  clientId: string;
  editorId: string;
}>;

export type OfficialDailyMcpPrincipal = Readonly<{
  actorId: string;
  clientId: string;
  expiresAt: number;
}>;

export function readOfficialDailyMcpConfig(
  env: Record<string, string | undefined> = process.env,
): OfficialDailyMcpConfig | null {
  const resource = env.OFFICIAL_DAILY_EDITOR_MCP_RESOURCE_URL;
  const supabase = env.SUPABASE_URL;
  const clientId = env.OFFICIAL_DAILY_EDITOR_MCP_CLIENT_ID;
  const editorId = env.OFFICIAL_DAILY_EDITOR_MCP_USER_ID;
  if (!resource || !supabase || !clientId || !editorId || !UUID.test(editorId)
      || !/^[\w.:-]{8,256}$/.test(clientId)) return null;
  try {
    const issuer = new URL(supabase);
    const parsed = new URL(resource);
    if (issuer.protocol !== 'https:' || issuer.username || issuer.password
        || issuer.pathname !== '/' || issuer.search || issuer.hash
        || parsed.protocol !== 'https:' || parsed.username || parsed.password
        || parsed.search || parsed.hash || parsed.pathname !== ENDPOINT) return null;
    return {
      resource: parsed.href, issuer: issuer.origin + '/auth/v1',
      authorizationServer: issuer.origin + '/auth/v1',
      clientId, editorId: editorId.toLowerCase(),
    };
  } catch { return null; }
}

export function isOfficialDailyMcpRequestOrigin(request: Request, config: OfficialDailyMcpConfig): boolean {
  const expected = new URL(config.resource);
  const host = request.headers.get('host');
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  return request.url === expected.href
    && (host === null || host.toLowerCase() === expected.host.toLowerCase())
    && (origin === null || origin === expected.origin)
    && (site === null || site === 'same-origin' || site === 'none');
}

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function keySet(issuer: string) {
  let keys = keySets.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(issuer + '/.well-known/jwks.json'), {
      timeoutDuration: 3000, cooldownDuration: 30000,
    });
    keySets.set(issuer, keys);
  }
  return keys;
}

type Verifier = typeof jwtVerify;
/** Signature, exact issuer/resource audience, OAuth client, editor and expiry all mandatory. */
export async function verifyOfficialDailyMcpBearer(
  authorization: string | null,
  config: OfficialDailyMcpConfig,
  verify: Verifier = jwtVerify,
  keys: typeof keySet = keySet,
): Promise<OfficialDailyMcpPrincipal | null> {
  const match = authorization?.match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  const token = match?.[1];
  if (!token || token.length > 8192) return null;
  try {
    const { payload }: JWTVerifyResult = await verify(token, keys(config.issuer), {
      issuer: config.issuer, audience: config.resource,
      algorithms: ['RS256', 'ES256'], clockTolerance: 5,
    });
    if (typeof payload.exp !== 'number' || typeof payload.iat !== 'number'
        || payload.sub?.toLowerCase() !== config.editorId
        || payload.client_id !== config.clientId || payload.role !== 'authenticated'
        || (payload.authentication_method !== undefined
          && payload.authentication_method !== 'oauth_provider/authorization_code')) return null;
    return { actorId: 'mcp:' + config.editorId, clientId: config.clientId, expiresAt: payload.exp };
  } catch { return null; }
}

export function officialDailyMcpChallenge(config: OfficialDailyMcpConfig): string {
  return 'Bearer resource_metadata="' + new URL('/.well-known/oauth-protected-resource', config.resource).href + '"';
}
