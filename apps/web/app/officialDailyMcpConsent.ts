import 'server-only';
import { creatorAuthEnvironment } from './serverCreatorAccountAuth';
import { readOfficialDailyMcpConfig } from './officialDailyMcpAuthorization';

const IDENTIFIER = /^[A-Za-z0-9_-]{16,128}$/;
const SCOPES = new Set(['openid', 'email', 'profile']);

export function validOfficialDailyOAuthAuthorizationId(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER.test(value);
}

/** A third, separately switchable QA-only consent gate; never infer activation from source deployment. */
export function readOfficialDailyMcpConsentConfig(env: Record<string, string | undefined> = process.env) {
  if (env.OFFICIAL_DAILY_EDITOR_MCP_CONSENT_ENABLED !== 'true'
      || env.OFFICIAL_DAILY_EDITOR_MCP_ENABLED !== 'true'
      || env.OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED !== 'true') return null;
  const creator = creatorAuthEnvironment();
  const mcp = readOfficialDailyMcpConfig(env);
  const callback = env.OFFICIAL_DAILY_EDITOR_MCP_CALLBACK_URL;
  if (!creator || !mcp || !callback || callback.length > 512) return null;
  try {
    const url = new URL(callback);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search
        || url.origin + url.pathname !== callback
        || creator.origin !== new URL(mcp.resource).origin
        || creator.supabaseUrl !== new URL(mcp.issuer).origin) return null;
    return { ...mcp, creator, callback };
  } catch { return null; }
}

export type OfficialDailyMcpConsentConfig = NonNullable<ReturnType<typeof readOfficialDailyMcpConsentConfig>>;
export type OAuthConsentView =
  | { kind: 'consent'; clientName: string; scopes: string }
  | { kind: 'redirect'; url: string };

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Only the one registered OAuth client and one signed-in editor can authorize this resource. */
export function inspectOfficialDailyOAuthDetails(
  value: unknown,
  authorizationId: string,
  config: Pick<OfficialDailyMcpConsentConfig, 'clientId' | 'editorId' | 'callback'>,
): OAuthConsentView | null {
  if (!object(value) || !validOfficialDailyOAuthAuthorizationId(authorizationId)) return null;
  if (!('authorization_id' in value)) {
    return typeof value.redirect_url === 'string'
      && validOfficialDailyOAuthRedirect(value.redirect_url, config.callback)
      ? { kind: 'redirect', url: value.redirect_url } : null;
  }
  if (value.authorization_id !== authorizationId || !object(value.client) || !object(value.user)
      || value.client.id !== config.clientId || value.user.id !== config.editorId
      || value.redirect_uri !== config.callback || typeof value.scope !== 'string'
      || value.scope.length > 128 || typeof value.client.name !== 'string'
      || value.client.name.length < 1 || value.client.name.length > 128) return null;
  const scopes = value.scope.trim().split(/\s+/);
  if (scopes.length === 0 || !scopes.every(scope => SCOPES.has(scope))
      || !scopes.includes('openid') || new Set(scopes).size !== scopes.length) return null;
  return { kind: 'consent', clientName: value.client.name, scopes: scopes.join(' ') };
}

/** A provider-generated redirect is never followed unless it targets our exact pre-registered callback. */
export function validOfficialDailyOAuthRedirect(value: unknown, callback: string): value is string {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try {
    const url = new URL(value);
    const expected = new URL(callback);
    if (url.origin !== expected.origin || url.pathname !== expected.pathname
        || url.protocol !== 'https:' || url.username || url.password || url.hash) return false;
    const keys = [...url.searchParams.keys()];
    if (keys.length !== new Set(keys).size
        || keys.some(key => !['code', 'state', 'error', 'error_description', 'iss'].includes(key))) return false;
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const state = url.searchParams.get('state');
    return !!state && state.length >= 8 && state.length <= 512
      && ((!!code && code.length <= 2048 && !error)
        || (!!error && error.length <= 128 && !code));
  } catch { return false; }
}
