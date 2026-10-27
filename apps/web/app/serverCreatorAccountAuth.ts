import 'server-only';
import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

const NO_STORE = 'private, no-store';

type CookieChange = Parameters<SetAllCookies>[0][number];

/** Account auth is a separate, default-off server boundary; never use the service-role key here. */
export function creatorAuthEnvironment() {
  const site = process.env.CREATOR_AUTH_SITE_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (process.env.CREATOR_AUTH_ENABLED !== 'true' || !site || !supabaseUrl || !key) return null;
  try {
    const origin = new URL(site);
    const backend = new URL(supabaseUrl);
    if (origin.origin !== site
      || (origin.protocol !== 'https:' && origin.hostname !== 'localhost')
      || backend.protocol !== 'https:' || backend.username || backend.password) return null;
    return { origin: origin.origin, supabaseUrl: backend.origin, key };
  } catch { return null; }
}

/** A server page cannot construct a NextRequest; verify its actual Host before rendering forms. */
export function creatorAuthPageHostAllowed(
  config: NonNullable<ReturnType<typeof creatorAuthEnvironment>>,
  requestHost: string | null,
): boolean {
  return requestHost === new URL(config.origin).host;
}

/** Request admission additionally binds the configured site to the actual incoming origin. */
export function creatorAuthConfiguration(request: NextRequest) {
  const config = creatorAuthEnvironment();
  return config && config.origin === request.nextUrl.origin ? config : null;
}

export function sameOriginPost(request: NextRequest): boolean {
  return request.headers.get('origin') === request.nextUrl.origin
    && request.nextUrl.search === '';
}

export function creatorAuthResponse(response: NextResponse): NextResponse {
  response.headers.set('cache-control', NO_STORE);
  return response;
}

export function creatorAuthClient(request: NextRequest, config: NonNullable<ReturnType<typeof creatorAuthConfiguration>>) {
  const changes: CookieChange[] = [];
  let cacheHeaders: Record<string, string> = {};
  const client = createServerClient(config.supabaseUrl, config.key, {
    auth: { flowType: 'pkce' },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies, headers) {
        changes.push(...cookies);
        cacheHeaders = { ...cacheHeaders, ...headers };
      },
    },
  });
  return {
    client,
    finish(response: NextResponse) {
      for (const { name, value, options } of changes) {
        response.cookies.set(name, value, {
          ...options, path: '/', sameSite: 'lax', httpOnly: true,
          secure: config.origin.startsWith('https://'),
          // The browser session must never be scoped to a parent domain.
          domain: undefined,
        });
      }
      for (const [name, value] of Object.entries(cacheHeaders)) response.headers.set(name, value);
      return creatorAuthResponse(response);
    },
  };
}

/**
 * Session lookup distinguishes signed-in verification failures from guests.
 * Server gameplay callers must fail closed on unavailable Auth; creation can
 * continue to return a generic unauthorized status without exposing details.
 */
export async function inspectCreatorAccountSession(
  client: ReturnType<typeof creatorAuthClient>['client'],
): Promise<{ kind: 'verified'; id: string } | { kind: 'guest' } | { kind: 'unavailable' }> {
  try {
    const { data, error } = await client.auth.getUser();
    if (error) return { kind: 'unavailable' };
    const user = data.user;
    if (!user || user.is_anonymous === true || !user.email_confirmed_at) return { kind: 'guest' };
    return { kind: 'verified', id: user.id };
  } catch { return { kind: 'unavailable' }; }
}

export async function verifiedCreatorAccount(client: ReturnType<typeof creatorAuthClient>['client']) {
  const observed = await inspectCreatorAccountSession(client);
  return observed.kind === 'verified' ? { id: observed.id } : null;
}

/** Bounded, URL-encoded form parser for small auth requests. Reject duplicate fields. */
export async function creatorAuthForm(request: NextRequest): Promise<URLSearchParams | null> {
  if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
    !== 'application/x-www-form-urlencoded') return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 1024) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const params = new URLSearchParams(new TextDecoder('utf-8', { fatal: true }).decode(
      Buffer.concat(chunks),
    ));
    if ([...params.keys()].length !== new Set(params.keys()).size) return null;
    return params;
  } catch { return null; }
}
