import { normalizeDailyTerminalAtBat } from '@initial-baseball/engine';
import type { DailyCompletedAtBat, DailyGuessResult } from '@initial-baseball/shared';
import type { CanonicalRevealViewModel } from './canonicalRevealViewModel';
import { decodeCustomNineTerminalResult, decodeCustomNineTerminalReveal }
  from './customNineGameplayPayloadCodec';
import type { DailyAuthorizedHint, DailyHintBundle, DailyHintResponse } from './dailyRuntimeContracts';

const V2_ID = /^custom-lineup-v2-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TYPES = new Set(['main_decade', 'teams', 'position', 'stats']);
export type CustomLineupV2PublicAtBat = Readonly<{ pitchNumber: number; initials: string }>;
type Opening = Readonly<{ puzzleId: string; atBats: readonly CustomLineupV2PublicAtBat[];
  rulesetVersion: 'points-v4'; progressionToken: string; hintBundle: DailyHintBundle }>;
export type CustomLineupV2BrowserState =
  | (Opening & { attemptMode: 'reserved';
    attemptProgress: { strikeCount: 0 | 1 | 2; completedAtBats: readonly DailyCompletedAtBat[] } })
  | (Opening & { attemptMode: 'creator_preview' })
  | Readonly<{ attemptMode: 'completed'; atBats: readonly CustomLineupV2PublicAtBat[];
    completedAtBats: readonly DailyCompletedAtBat[]; revision: number; completedAt: string }>;
export type CustomLineupV2BrowserResolution =
  | Readonly<{ kind: 'incorrect'; progressionToken: string; strikeCount: 1 | 2; revision: number }>
  | Readonly<{ kind: 'terminal'; progressionToken: string; revision: number; completed: boolean;
    result: Exclude<DailyGuessResult, {kind: 'incorrect'}>;
    reveal: CanonicalRevealViewModel; hintBundle: DailyHintBundle | null }>;

export type CustomLineupV2TransportErrorKind =
  | 'not_found' | 'invalid_credential' | 'invalid_request' | 'conflict'
  | 'completed' | 'unavailable' | 'invalid_response' | 'unsupported_browser';
export class CustomLineupV2TransportError extends Error {
  constructor(readonly kind: CustomLineupV2TransportErrorKind) {
    super('Custom Lineup ' + kind.replaceAll('_', ' ') + '.');
    this.name = 'CustomLineupV2TransportError';
  }
}
type FetchPort = (url: string, init: RequestInit) => Promise<Response>;
// The current TypeScript DOM lib omits Web Locks declarations. Keep only the
// narrow standard request overload this transport actually needs.
type BootstrapLockPort = {
  request<T>(name: string, options: { mode: 'exclusive' },
    task: () => Promise<T>): Promise<T>;
};
type Action = 'bootstrap' | 'hint' | 'resolve' | 'submit';
type Guess = { submittedPlayerId: string } | { giveUp: true };

// The lock covers the whole HTTP bootstrap, including response consumption:
// a second same-origin tab cannot issue a cookie-less request until the first
// response's Set-Cookie has been processed by the browser.
export function createCustomLineupV2BrowserTransport(
  fetchPort: FetchPort = fetch,
  bootstrapLocks: BootstrapLockPort | null =
    typeof navigator === 'undefined' ? null
      : (navigator as Navigator & { locks?: BootstrapLockPort }).locks ?? null,
) {
  async function post(id: string, action: Action, body?: Record<string, unknown>): Promise<unknown> {
    if (!V2_ID.test(id)) invalid('invalid_request');
    let reply: Response;
    try {
      reply = await fetchPort('/api/custom-lineup/challenges/' + id + '/attempt/' + action, {
        method: 'POST', credentials: 'same-origin',
        ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body) }),
      });
    } catch { invalid('unavailable'); }
    let data: unknown;
    try { data = await reply.json(); }
    catch { invalid(reply.ok ? 'invalid_response' : 'unavailable'); }
    if (!reply.ok) {
      const label = record(data) ? data.error : null;
      invalid(reply.status === 404 ? 'not_found'
        : reply.status === 403 ? 'invalid_credential'
          : reply.status === 409
            ? label === 'completed' ? 'completed' : 'conflict'
            : reply.status === 400 ? 'invalid_request' : 'unavailable');
    }
    return data;
  }
  return {
    bootstrap: async (id: string): Promise<CustomLineupV2BrowserState> => {
      if (!V2_ID.test(id)) invalid('invalid_request');
      // Never silently fall back to racing credential issuance. A browser with
      // no cross-tab lock support must not create an unreliable first attempt.
      if (!bootstrapLocks) invalid('unsupported_browser');
      try {
        return await bootstrapLocks.request(
          'initial-baseball:custom-lineup-v2:bootstrap:' + id,
          { mode: 'exclusive' },
          async () => decodeBootstrap(await post(id, 'bootstrap'), id),
        );
      } catch (error) {
        if (error instanceof CustomLineupV2TransportError) throw error;
        invalid('unavailable');
      }
    },
    revealHint: async (id: string, token: string): Promise<{
      hint: DailyHintResponse['hint']; progressionToken: string; revision: number;
    }> => decodeHint(await post(id, 'hint', { progressionToken: token })),
    resolve: async (id: string, token: string, currentPitch: number, totalAtBats: number,
      action: Guess): Promise<CustomLineupV2BrowserResolution> => {
      if (!integer(totalAtBats, 1, 10) || !integer(currentPitch, 1, totalAtBats)
        || !signed(token) || ('submittedPlayerId' in action
          && !/^ibp_[0-9a-f]{20}$/.test(action.submittedPlayerId))) invalid('invalid_request');
      return decodeResolution(await post(id, 'resolve', { progressionToken: token, ...action }),
        currentPitch, totalAtBats);
    },
    submit: async (id: string): Promise<'created' | 'existing'> => {
      const data = await post(id, 'submit');
      if (!record(data) || (data.status !== 'created' && data.status !== 'existing')) invalid();
      return data.status;
    },
  };
}

function decodeBootstrap(value: unknown, id: string): CustomLineupV2BrowserState {
  if (!record(value) || !Array.isArray(value.atBats)) invalid();
  const atBats = pitches(value.atBats);
  const n = atBats.length;
  if (value.attemptMode === 'completed') {
    const facts = terminalFacts(value.completedAtBats, atBats, true);
    if (!integer(value.revision, n, Number.MAX_SAFE_INTEGER)
      || typeof value.completedAt !== 'string'
      || !Number.isFinite(Date.parse(value.completedAt)) || 'progressionToken' in value
      || 'hintBundle' in value || 'attemptProgress' in value) invalid();
    return { attemptMode: 'completed', atBats, completedAtBats: facts,
      revision: value.revision as number, completedAt: value.completedAt };
  }
  if (value.puzzleId !== id || value.rulesetVersion !== 'points-v4'
    || !signed(value.progressionToken)) invalid();
  const bundle = readBundle(value.hintBundle, n);
  if (value.attemptMode === 'creator_preview') {
    if ('attemptProgress' in value || bundle.pitchNumber !== 1
      || bundle.revealedCount !== 0 || bundle.hints.length !== 0) invalid();
    return { attemptMode: 'creator_preview', puzzleId: id, rulesetVersion: 'points-v4',
      atBats, progressionToken: value.progressionToken as string, hintBundle: bundle };
  }
  if (value.attemptMode !== 'reserved' || !record(value.attemptProgress)
    || !integer(value.attemptProgress.strikeCount, 0, 2)) invalid();
  const facts = terminalFacts(value.attemptProgress.completedAtBats, atBats, false);
  if (bundle.pitchNumber !== facts.length + 1) invalid();
  return { attemptMode: 'reserved', puzzleId: id, rulesetVersion: 'points-v4',
    atBats, progressionToken: value.progressionToken as string, hintBundle: bundle,
    attemptProgress: { strikeCount: value.attemptProgress.strikeCount as 0 | 1 | 2,
      completedAtBats: facts } };
}
function pitches(value: readonly unknown[]): CustomLineupV2PublicAtBat[] {
  if (value.length < 1 || value.length > 10) invalid();
  return value.map((item, index) => {
    if (!record(item) || item.pitchNumber !== index + 1 || !text(item.initials)) invalid();
    return { pitchNumber: index + 1, initials: item.initials as string };
  });
}
function terminalFacts(value: unknown, atBats: readonly CustomLineupV2PublicAtBat[],
  completed: boolean): DailyCompletedAtBat[] {
  if (!Array.isArray(value) || (completed ? value.length !== atBats.length
    : value.length >= atBats.length)) invalid();
  return value.map((fact: unknown, index: number) => {
    const result = normalizeDailyTerminalAtBat(fact, atBats[index]);
    if (!result.ok) invalid();
    return result.atBat;
  });
}
function readBundle(value: unknown, n: number): DailyHintBundle {
  if (!record(value) || !integer(value.pitchNumber, 1, n)
    || !integer(value.revealedCount, 0, 4)
    || !Array.isArray(value.hints) || value.hints.length !== value.revealedCount
    || !Array.isArray(value.checkpoints) || value.checkpoints.length !== 0) invalid();
  const hints: DailyAuthorizedHint[] = value.hints.map((item: unknown, i: number) => {
    if (!record(item) || item.slot !== i + 1 || !TYPES.has(String(item.hintType))
      || !text(item.hintLabel) || !text(item.hintValue)) invalid();
    return { slot: (i + 1) as 1 | 2 | 3 | 4,
      hintType: item.hintType as DailyAuthorizedHint['hintType'],
      hintLabel: item.hintLabel as string, hintValue: item.hintValue as string };
  });
  return { pitchNumber: value.pitchNumber as number,
    revealedCount: value.revealedCount as 0 | 1 | 2 | 3 | 4, hints, checkpoints: [] };
}
function decodeHint(value: unknown) {
  if (!record(value) || !record(value.hint) || !signed(value.progressionToken)
    || !integer(value.revision, 1, Number.MAX_SAFE_INTEGER)) invalid();
  const hint = value.hint;
  if (!TYPES.has(String(hint.hintType)) || !text(hint.hintLabel) || !text(hint.hintValue)) invalid();
  return { hint: { hintType: hint.hintType as DailyHintResponse['hint']['hintType'],
    hintLabel: hint.hintLabel as string, hintValue: hint.hintValue as string },
  progressionToken: value.progressionToken as string, revision: value.revision as number };
}
function decodeResolution(value: unknown, pitch: number, n: number):
  CustomLineupV2BrowserResolution {
  if (!record(value) || !signed(value.progressionToken)
    || !integer(value.revision, 1, Number.MAX_SAFE_INTEGER)) invalid();
  if (value.kind === 'incorrect') {
    if (value.strikeCount !== 1 && value.strikeCount !== 2) invalid();
    return { kind: 'incorrect', strikeCount: value.strikeCount, revision: value.revision as number,
      progressionToken: value.progressionToken as string };
  }
  if (value.kind !== 'terminal' || value.completed !== (pitch === n)) invalid();
  let result: Exclude<DailyGuessResult, {kind: 'incorrect'}>;
  let reveal: CanonicalRevealViewModel;
  try {
    result = decodeCustomNineTerminalResult(value.result);
    reveal = decodeCustomNineTerminalReveal(value.reveal);
  } catch { invalid(); }
  const next = value.hintBundle === null ? null : readBundle(value.hintBundle, n);
  if (pitch === n ? next !== null : next === null
    || next.pitchNumber !== pitch + 1 || next.revealedCount !== 0
    || next.hints.length !== 0) invalid();
  return { kind: 'terminal', result, reveal, progressionToken: value.progressionToken as string,
    revision: value.revision as number, completed: value.completed as boolean, hintBundle: next };
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function signed(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 4096;
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 2048;
}
function integer(value: unknown, low: number, high: number): boolean {
  return Number.isSafeInteger(value) && (value as number) >= low && (value as number) <= high;
}
function invalid(kind: CustomLineupV2TransportErrorKind = 'invalid_response'): never {
  throw new CustomLineupV2TransportError(kind);
}
