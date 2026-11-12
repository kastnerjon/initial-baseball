// Browser-only syntax guard; importing the Daily server validator would pull
// private canonical data into the client bundle (hidden-answer build QA).
const V2_ID = /^custom-lineup-v2-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
import { parseCompletionDisplayName } from '@initial-baseball/shared';

export type CustomV2CompletionDisplay =
  | Readonly<{ mode: 'anonymous'; displayName: null }>
  | Readonly<{ mode: 'named'; displayName: string }>;
export type CustomV2CompletionDisplayChoice =
  | Readonly<{ mode: 'anonymous' }>
  | Readonly<{ mode: 'named'; displayName: string }>;

export class CustomV2CompletionDisplayTransportError extends Error {
  constructor(public readonly kind: 'unavailable' | 'invalid_credential') {
    super('Could not access the saved Custom Lineup result.');
    this.name = 'CustomV2CompletionDisplayTransportError';
  }
}

function pathFor(puzzleId: string): string {
  if (!V2_ID.test(puzzleId)) unavailable();
  return '/api/custom-lineup/challenges/' + puzzleId + '/completion/display';
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function unavailable(status?: number): never {
  throw new CustomV2CompletionDisplayTransportError(
    status === 403 ? 'invalid_credential' : 'unavailable',
  );
}
function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length
    && keys.every(key => Object.hasOwn(value, key));
}
async function readBody(response: Response): Promise<unknown> {
  if (!response.ok) unavailable(response.status);
  try { return await response.json() as unknown; }
  catch { return unavailable(); }
}
export function decodeCustomV2CompletionDisplayRead(value: unknown):
  CustomV2CompletionDisplay | null {
  if (!record(value)) return unavailable();
  if (value.status === 'not_set' && exactKeys(value, ['status'])) return null;
  if (value.status !== 'saved'
    || !exactKeys(value, ['status', 'mode', 'displayName'])) return unavailable();
  if (value.mode === 'anonymous' && value.displayName === null) {
    return { mode: 'anonymous', displayName: null };
  }
  if (value.mode !== 'named') return unavailable();
  const parsed = parseCompletionDisplayName(value.displayName);
  if (!parsed.ok || parsed.displayName !== value.displayName) return unavailable();
  return { mode: 'named', displayName: parsed.displayName };
}
export function decodeCustomV2CompletionDisplayWrite(value: unknown): 'created' | 'existing' {
  if (!record(value) || !exactKeys(value, ['status'])
    || (value.status !== 'created' && value.status !== 'existing')) return unavailable();
  return value.status;
}

/** Typed, privacy-strict client of the independently gated signed-cookie API.
 * No browser identity, roster, attempt, score or submission ID is serialized.
 */
export function createCustomV2CompletionDisplayBrowserTransport(fetcher: typeof fetch = fetch) {
  return {
    async read(puzzleId: string, signal?: AbortSignal): Promise<CustomV2CompletionDisplay | null> {
      // Some TypeScript DOM versions omit these standard fetch metadata fields.
      const init: RequestInit & { cache: 'no-store'; referrerPolicy: 'no-referrer' } = {
        method: 'GET', credentials: 'same-origin', cache: 'no-store',
        referrerPolicy: 'no-referrer',
        ...(signal === undefined ? {} : { signal }),
      };
      const response = await fetcher(pathFor(puzzleId), init);
      return decodeCustomV2CompletionDisplayRead(await readBody(response));
    },
    async record(puzzleId: string, choice: CustomV2CompletionDisplayChoice,
      signal?: AbortSignal): Promise<'created' | 'existing'> {
      let normalized: CustomV2CompletionDisplayChoice;
      if (choice.mode === 'anonymous' && Object.keys(choice).length === 1) {
        normalized = { mode: 'anonymous' };
      } else if (choice.mode === 'named' && Object.keys(choice).length === 2) {
        const parsed = parseCompletionDisplayName(choice.displayName);
        if (!parsed.ok || parsed.displayName !== choice.displayName) return unavailable();
        normalized = { mode: 'named', displayName: parsed.displayName };
      } else return unavailable();
      const init: RequestInit & { cache: 'no-store'; referrerPolicy: 'no-referrer' } = {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        referrerPolicy: 'no-referrer',
        ...(signal === undefined ? {} : { signal }),
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(normalized),
      };
      const response = await fetcher(pathFor(puzzleId), init);
      return decodeCustomV2CompletionDisplayWrite(await readBody(response));
    },
  };
}
