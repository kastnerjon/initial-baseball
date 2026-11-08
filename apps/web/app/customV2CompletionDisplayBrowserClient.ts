import { parseCompletionDisplayName } from '@initial-baseball/shared';

export type CustomCompletionDisplayChoice =
  | Readonly<{ mode: 'named'; displayName: string }>
  | Readonly<{ mode: 'anonymous' }>;
export type CustomCompletionDisplayState = CustomCompletionDisplayChoice | null;
export type CustomCompletionDisplayFailure = 'invalid' | 'unavailable' | 'unauthorized' | 'conflict';
export class CustomCompletionDisplayError extends Error {
  constructor(readonly kind: CustomCompletionDisplayFailure) {
    super('Custom completion display ' + kind + '.');
    this.name = 'CustomCompletionDisplayError';
  }
}

const V2 = /^custom-lineup-v2-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type FetchPort = (url: string, init: RequestInit) => Promise<Response>;
function fail(kind: CustomCompletionDisplayFailure): never {
  throw new CustomCompletionDisplayError(kind);
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function strictKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(k => k in value);
}
function safeChoice(value: unknown): CustomCompletionDisplayChoice | null {
  if (!record(value)) return null;
  if (value.mode === 'anonymous' && strictKeys(value, ['mode'])) return { mode: 'anonymous' };
  if (value.mode === 'named' && strictKeys(value, ['mode', 'displayName'])) {
    const parsed = parseCompletionDisplayName(value.displayName);
    if (parsed.ok && parsed.displayName === value.displayName) {
      return { mode: 'named', displayName: parsed.displayName };
    }
  }
  return null;
}

/** Cookie-scoped presentation only, never a score/name authority. */
export function createCustomV2CompletionDisplayBrowserClient(
  fetchPort: FetchPort = fetch,
) {
  async function request(
    id: string, method: 'GET' | 'POST', choice?: CustomCompletionDisplayChoice,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (!V2.test(id)) fail('invalid');
    const url = '/api/custom-lineup/challenges/' + id + '/display';
    let response: Response;
    try {
      response = await fetchPort(url, {
        method, credentials: 'same-origin', ...(signal ? { signal } : {}),
        ...(method === 'POST'
          ? { headers: { 'content-type': 'application/json' },
            body: JSON.stringify(choice) } : {}),
      });
    } catch { return fail('unavailable'); }
    if (!response.ok) {
      fail(response.status === 409 ? 'conflict'
        : response.status === 403 ? 'unauthorized'
          : response.status === 400 ? 'invalid' : 'unavailable');
    }
    try { return await response.json() as unknown; }
    catch { return fail('unavailable'); }
  }
  return {
    async read(id: string, signal?: AbortSignal): Promise<CustomCompletionDisplayState> {
      const value = await request(id, 'GET', undefined, signal);
      if (!record(value)) fail('unavailable');
      if (value.status === 'unselected' && strictKeys(value, ['status'])) return null;
      if (value.status !== 'saved') fail('unavailable');
      if (value.mode === 'anonymous' && strictKeys(value, ['status', 'mode'])) {
        return { mode: 'anonymous' };
      }
      if (value.mode === 'named' && strictKeys(value, ['status', 'mode', 'displayName'])) {
        const parsed = safeChoice({ mode: value.mode, displayName: value.displayName });
        if (parsed !== null) return parsed;
      }
      return fail('unavailable');
    },
    async save(id: string, choice: CustomCompletionDisplayChoice, signal?: AbortSignal):
      Promise<'created' | 'existing'> {
      const normalized = safeChoice(choice);
      if (normalized === null) fail('invalid');
      const value = await request(id, 'POST', normalized, signal);
      if (!record(value) || !strictKeys(value, ['status'])
        || (value.status !== 'created' && value.status !== 'existing')) fail('unavailable');
      return value.status;
    },
  };
}
