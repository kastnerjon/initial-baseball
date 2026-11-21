import { NextResponse } from 'next/server';
import { DailyRuntimeRequestError } from './dailyRuntimeService';

export type Action = 'bootstrap' | 'hints' | 'hint' | 'resolve';

const MAX_POST_BODY_BYTES = 8192;

/** Reject bodies by bytes actually read, regardless of any declared Content-Length. */
export async function readBoundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) invalid();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_POST_BODY_BYTES) {
        void reader.cancel().catch(() => undefined);
        invalid();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    invalid();
  }
}

export function respond(value: unknown, status = 200): NextResponse {
  return NextResponse.json(value, {
    status,
    headers: { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
  });
}

export function invalid(): never {
  throw new DailyRuntimeRequestError('Invalid official Daily edition request.');
}

function parseToken(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) invalid();
  return value;
}

export function parseBody(value: unknown, action: Action) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid();
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body).sort();
  if (action === 'hints' || action === 'hint') {
    if (keys.join(',') !== 'progressionToken') invalid();
    return { progressionToken: parseToken(body.progressionToken) };
  }
  if (action !== 'resolve') invalid();
  if (keys.join(',') === 'giveUp,progressionToken' && body.giveUp === true) {
    return { progressionToken: parseToken(body.progressionToken), giveUp: true as const };
  }
  if (keys.join(',') === 'progressionToken,submittedPlayerId'
      && typeof body.submittedPlayerId === 'string'
      && body.submittedPlayerId.length > 0 && body.submittedPlayerId.length <= 100) {
    return {
      progressionToken: parseToken(body.progressionToken),
      submittedPlayerId: body.submittedPlayerId,
    };
  }
  invalid();
}
