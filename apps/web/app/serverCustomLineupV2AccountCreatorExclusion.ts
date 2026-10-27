import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { validateCustomLineupPuzzleId } from '@initial-baseball/daily';
import { creatorAuthClient, creatorAuthConfiguration, inspectCreatorAccountSession } from './serverCreatorAccountAuth';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createCustomLineupV2AttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { getDailyProgressionSecret } from './dailyProgressionSecret';

type Context = Readonly<{ owner: boolean; finish: (response: Response) => Response }>;
const NONE: Context = { owner: false, finish: response => response };

function completeWithRefreshedAuthCookies(
  response: Response, finish: ReturnType<typeof creatorAuthClient>['finish'],
): Response {
  // The SSR adapter rebuilds Set-Cookie when rotating a session. Preserve an
  // existing challenge-scoped attempt cookie by appending it AFTER Auth finish.
  const attemptCookie = response.headers.get('set-cookie');
  const headers = new Headers(response.headers);
  if (attemptCookie !== null) headers.delete('set-cookie');
  const out = finish(new NextResponse(response.body, {
    status: response.status, headers,
  }));
  if (attemptCookie !== null) out.headers.append('set-cookie', attemptCookie);
  return out;
}

/**
 * Request-scoped identity admission for Custom GAMEPLAY, not a requirement
 * to sign in. Only compare the verified Supabase Auth UUID with the private
 * immutable creator UUID. Never accept a creator flag or UUID from the client.
 */
export async function inspectCustomLineupV2AccountCreator(
  request: Request, puzzleId: string, cookieHeader: string | null,
): Promise<Context> {
  validateCustomLineupPuzzleId(puzzleId);
  if (process.env.CREATOR_AUTH_ENABLED !== 'true') return NONE;
  // No Supabase session cookie means a genuine anonymous friend request.
  // Default SSR cookie name is sb-<project-ref>-auth-token (possibly chunked).
  // Never block guests merely because Auth itself is slow or unavailable.
  const hasAuthCookie = /(?:^|;\\s*)sb-[A-Za-z0-9_-]+-auth-token(?:\\.[0-9]+)?=/.test(cookieHeader ?? '');
  if (!hasAuthCookie) return NONE;
  // Reconstruct only headers/URL, not the already-bound POST body stream.
  const authRequest = new NextRequest(request.url, { headers: request.headers });
  const config = creatorAuthConfiguration(authRequest);
  if (!config) throw new Error('Custom creator identity configuration unavailable.');
  const auth = creatorAuthClient(authRequest, config);
  const finish = (response: Response) => completeWithRefreshedAuthCookies(response, auth.finish);
  const account = await inspectCreatorAccountSession(auth.client);
  if (account.kind === 'unavailable') {
    throw new Error('Custom creator account verification unavailable.');
  }
  if (account.kind === 'guest') return { owner: false, finish };

  // Explicit narrow owner read. Issued canonical player IDs and clue snapshots
  // must never cross this server-only query.
  const service = createServerSupabaseClient();
  const found = await service.from('custom_nine_issued_challenges')
    .select('creator_account_id')
    .eq('puzzle_id', puzzleId).eq('schema_version', 2).maybeSingle();
  if (found.error || (found.data !== null
    && (typeof found.data.creator_account_id !== 'string'
      && found.data.creator_account_id !== null))) {
    throw new Error('Custom creator ownership lookup unavailable.');
  }
  if (found.data?.creator_account_id !== account.id) return { owner: false, finish };

  // An owner could have played as a guest before logging in. The attempt row
  // becomes irrevocably noncompetitive; the RPC checks under its FOR UPDATE
  // lock, so signout cannot erase the observation.
  const browser = createCustomLineupV2AttemptBrowserCredential(getDailyProgressionSecret())
    .inspect(cookieHeader, puzzleId);
  if (browser.kind === 'valid') {
    const marked = await service.from('custom_nine_attempt_states')
      .update({ creator_seen: true })
      .eq('challenge_id', puzzleId)
      .eq('browser_key_digest', browser.browserKeyDigest)
      .select('creator_seen').maybeSingle();
    if (marked.error || (marked.data !== null && marked.data.creator_seen !== true)) {
      throw new Error('Custom creator eligibility marker unavailable.');
    }
  }
  // Missing/invalid credentials do not create an attempt for an owner. The
  // bootstrap service independently rejects tampered legacy browser cookies.
  return { owner: true, finish };
}
