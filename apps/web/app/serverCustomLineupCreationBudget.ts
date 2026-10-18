import 'server-only';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { createServerSupabaseClient } from './serverSupabaseClient';

const DOMAIN = 'initial-baseball:custom-lineup-creation-budget:v1';
const MIN_SECRET_LENGTH = 32;

/**
 * Vercel overwrites x-forwarded-for at its ingress. Never accept the same
 * header from local/non-Vercel requests, a comma-separated proxy chain, or a
 * browser-provided digest. No raw IP is persisted or returned.
 */
export function verifiedVercelCreationIp(
  request: Request,
  env: Record<string, string | undefined>,
): string | null {
  if (env.VERCEL !== '1' || !['production', 'preview'].includes(env.VERCEL_ENV ?? '')) {
    return null;
  }
  const forwarded = request.headers.get('x-forwarded-for');
  if (!forwarded || forwarded !== forwarded.trim() || forwarded.includes(',')
    || isIP(forwarded) === 0) return null;
  // Reject disagreement instead of guessing which proxy address is authentic.
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for');
  if (vercelForwarded !== null && vercelForwarded !== forwarded) return null;
  return forwarded;
}

export function deriveCreationBudgetDigest(
  ip: string, day: string, secret: string,
): string {
  if (isIP(ip) === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(day)
    || secret.trim().length < MIN_SECRET_LENGTH) {
    throw new Error('Creation budget configuration unavailable.');
  }
  return createHmac('sha256', secret)
    .update(DOMAIN + '\n' + day + '\n' + ip, 'utf8')
    .digest('hex');
}

export type CustomCreationReservation =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export async function reservePublicCustomLineupCreation(
  request: Request,
  environment: Record<string, string | undefined> = process.env,
  now: () => Date = () => new Date(),
): Promise<CustomCreationReservation> {
  const ip = verifiedVercelCreationIp(request, environment);
  const secret = environment.CUSTOM_LINEUP_CREATION_BUDGET_SECRET;
  if (ip === null || !secret || secret.trim().length < MIN_SECRET_LENGTH) {
    throw new Error('Creation budget configuration unavailable.');
  }
  let day = now().toISOString().slice(0, 10);
  const client = createServerSupabaseClient(environment);
  // Database time is authoritative. A queued pre-midnight request must never
  // reserve a post-midnight 10-minute bucket under yesterday's HMAC key.
  for (let attempt = 0; attempt < 2; attempt++) {
    const digest = deriveCreationBudgetDigest(ip, day, secret);
    const { data, error } = await client.rpc('reserve_custom_lineup_creation_budget', {
      p_client_digest: digest,
      p_claimed_utc_day: day,
    });
    if (error || !Array.isArray(data) || data.length !== 1) {
      throw new Error('Creation budget provider unavailable.');
    }
    const result: unknown = data[0];
    if (result === null || typeof result !== 'object') {
      throw new Error('Invalid creation budget response.');
    }
    const value = result as Record<string, unknown>;
    const actualDay = value.server_utc_day;
    if (typeof actualDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(actualDay)) {
      throw new Error('Invalid creation budget response.');
    }
    if (value.allowed === false && value.retry_after_seconds === 0
      && actualDay !== day) {
      day = actualDay;
      continue; // Zero-quota-cost clock reconciliation, at most once.
    }
    if (actualDay !== day) throw new Error('Invalid creation budget response.');
    if (value.allowed === true && value.retry_after_seconds === 0) {
      return { allowed: true };
    }
    if (value.allowed === false
      && Number.isInteger(value.retry_after_seconds)
      && typeof value.retry_after_seconds === 'number'
      && value.retry_after_seconds >= 1 && value.retry_after_seconds <= 86400) {
      return { allowed: false, retryAfterSeconds: value.retry_after_seconds };
    }
    throw new Error('Invalid creation budget response.');
  }
  throw new Error('Creation budget UTC day changed repeatedly.');
}
