import { normalizeDailyTerminalAtBat } from '@initial-baseball/engine';
import type { DailyCompletedAtBat, DailyGuessResult } from '@initial-baseball/shared';
import type { CanonicalRevealViewModel } from './canonicalRevealViewModel';
import { decodeCustomNineTerminalResult, decodeCustomNineTerminalReveal } from './customNineGameplayPayloadCodec';
import type { DailyAuthorizedHint, DailyHintBundle, DailyHintResponse } from './dailyRuntimeContracts';

export type CustomNinePublicAtBat = Readonly<{ pitchNumber: number; initials: string }>;
export type CustomNineAttemptProgress = Readonly<{
  strikeCount: 0 | 1 | 2;
  completedAtBats: readonly DailyCompletedAtBat[];
}>;
type BootstrapBase = Readonly<{
  puzzleId: string;
  rulesetVersion: 'points-v4';
  atBats: readonly CustomNinePublicAtBat[];
  progressionToken: string;
  hintBundle: DailyHintBundle;
}>;
export type CustomNineBrowserBootstrap =
  | (BootstrapBase & { attemptMode: 'reserved'; attemptProgress: CustomNineAttemptProgress })
  | (BootstrapBase & { attemptMode: 'creator_preview' });

export type CustomNineBrowserHintResult = Readonly<{
  hint: DailyHintResponse['hint'];
  progressionToken: string;
  revision: number;
}>;
export type CustomNineBrowserResolveResult =
  | Readonly<{ kind: 'incorrect'; strikeCount: 1 | 2; progressionToken: string; revision: number }>
  | Readonly<{ kind: 'terminal'; result: Exclude<DailyGuessResult, { kind: 'incorrect' }>;
    reveal: CanonicalRevealViewModel; progressionToken: string;
    hintBundle: DailyHintBundle | null; revision: number }>;

export type CustomNineBrowserTransportErrorKind =
  | 'not_found' | 'invalid_credential' | 'completed' | 'conflict'
  | 'invalid_request' | 'unavailable' | 'invalid_response';
export class CustomNineBrowserTransportError extends Error {
  constructor(readonly kind: CustomNineBrowserTransportErrorKind) {
    super('Custom Nine ' + kind.replaceAll('_', ' ') + '.');
    this.name = 'CustomNineBrowserTransportError';
  }
}

type FetchPort = (input: string, init: RequestInit) => Promise<Response>;
type Guess = { submittedPlayerId: string } | { giveUp: true };

/**
 * Headless client for the server-monotonic Custom Nine attempt protocol.
 * It never creates browser-owned attempts or locally advances signed tokens.
 * An uncertain/failed action must be reconciled via bootstrap, not retried
 * optimistically: the server may have committed the first request.
 */
export function createCustomNineBrowserTransport(fetchPort: FetchPort = fetch) {
  return {
    bootstrap: async (challengeId: string): Promise<CustomNineBrowserBootstrap> =>
      decodeBootstrap(await post(challengeId, 'bootstrap'), challengeId),
    revealHint: async (challengeId: string, token: string): Promise<CustomNineBrowserHintResult> =>
      decodeHint(await post(challengeId, 'hint', { progressionToken: token })),
    resolve: async (challengeId: string, token: string, action: Guess): Promise<CustomNineBrowserResolveResult> =>
      decodeResolution(await post(challengeId, 'resolve', { progressionToken: token, ...action })),
  };

  async function post(challengeId: string, action: string, body?: Record<string, unknown>): Promise<unknown> {
    if (typeof challengeId !== 'string' || challengeId.length === 0 || challengeId.length > 200) {
      throw new CustomNineBrowserTransportError('invalid_request');
    }
    const path = '/api/custom-nine/challenges/' + encodeURIComponent(challengeId) + '/attempt/' + action;
    let response: Response;
    try {
      response = await fetchPort(path, {
        method: 'POST', credentials: 'same-origin',
        ...(body === undefined ? {} : {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
      });
    } catch {
      throw new CustomNineBrowserTransportError('unavailable');
    }
    let data: unknown;
    try { data = await response.json(); }
    catch { throw new CustomNineBrowserTransportError(response.ok ? 'invalid_response' : 'unavailable'); }
    if (!response.ok) {
      const error = record(data) ? data.error : null;
      const kind: CustomNineBrowserTransportErrorKind = response.status === 404 ? 'not_found'
        : response.status === 403 ? 'invalid_credential'
          : response.status === 409
            ? error === 'attempt_completed' || error === 'completed' ? 'completed' : 'conflict'
            : response.status === 400 ? 'invalid_request' : 'unavailable';
      throw new CustomNineBrowserTransportError(kind);
    }
    return data;
  }
}

function decodeBootstrap(value: unknown, requestedId: string): CustomNineBrowserBootstrap {
  if (!record(value) || value.puzzleId !== requestedId || value.rulesetVersion !== 'points-v4'
    || !validToken(value.progressionToken) || !Array.isArray(value.atBats)
    || value.atBats.length !== 9) invalid();
  const pitches: CustomNinePublicAtBat[] = value.atBats.map((pitch: unknown, index: number) => {
    if (!record(pitch) || pitch.pitchNumber !== index + 1 || !validText(pitch.initials)) invalid();
    return { pitchNumber: index + 1, initials: pitch.initials as string };
  });
  const hintBundle = decodeBundle(value.hintBundle);
  if (value.attemptMode === 'creator_preview') {
    if ('attemptProgress' in value) invalid();
    return { attemptMode: 'creator_preview', puzzleId: requestedId, rulesetVersion: 'points-v4',
      progressionToken: value.progressionToken as string, atBats: pitches, hintBundle };
  }
  if (value.attemptMode !== 'reserved' || !record(value.attemptProgress)
    || !numberIn(value.attemptProgress.strikeCount, 0, 2)
    || !Array.isArray(value.attemptProgress.completedAtBats)
    || value.attemptProgress.completedAtBats.length >= 9) invalid();
  const facts: DailyCompletedAtBat[] = value.attemptProgress.completedAtBats.map((fact: unknown, index: number) => {
    const expected = pitches[index];
    if (!expected) invalid();
    const result = normalizeDailyTerminalAtBat(fact, expected);
    if (!result.ok) invalid();
    return result.atBat;
  });
  if (hintBundle.pitchNumber !== facts.length + 1 || hintBundle.hints.length !== hintBundle.revealedCount
    || hintBundle.hints.some((hint, index) => hint.slot !== index + 1)
    || hintBundle.checkpoints.length !== 0) invalid();
  return { attemptMode: 'reserved', puzzleId: requestedId, rulesetVersion: 'points-v4',
    progressionToken: value.progressionToken as string, atBats: pitches, hintBundle,
    attemptProgress: { strikeCount: value.attemptProgress.strikeCount as 0 | 1 | 2, completedAtBats: facts } };
}

function decodeHint(value: unknown): CustomNineBrowserHintResult {
  if (!record(value) || !validToken(value.progressionToken)
    || !Number.isSafeInteger(value.revision) || (value.revision as number) < 1) invalid();
  return { hint: decodeRevealedHint(value.hint), progressionToken: value.progressionToken as string,
    revision: value.revision as number };
}

function decodeResolution(value: unknown): CustomNineBrowserResolveResult {
  if (!record(value) || !validToken(value.progressionToken)
    || !Number.isSafeInteger(value.revision) || (value.revision as number) < 1) invalid();
  if (value.kind === 'incorrect') {
    if (value.strikeCount !== 1 && value.strikeCount !== 2) invalid();
    return { kind: 'incorrect', strikeCount: value.strikeCount,
      progressionToken: value.progressionToken as string, revision: value.revision as number };
  }
  if (value.kind !== 'terminal') invalid();
  let result: Exclude<DailyGuessResult, { kind: 'incorrect' }>;
  let reveal: CanonicalRevealViewModel;
  try {
    result = decodeCustomNineTerminalResult(value.result);
    reveal = decodeCustomNineTerminalReveal(value.reveal);
  } catch { invalid(); }
  const next = value.hintBundle === null ? null : decodeBundle(value.hintBundle);
  if (next !== null && (next.pitchNumber < 2 || next.revealedCount !== 0
    || next.hints.length !== 0 || next.checkpoints.length !== 0)) invalid();
  return { kind: 'terminal', result, reveal,
    progressionToken: value.progressionToken as string,
    hintBundle: next, revision: value.revision as number };
}

function decodeBundle(value: unknown): DailyHintBundle {
  if (!record(value) || !numberIn(value.pitchNumber, 1, 9)
    || !numberIn(value.revealedCount, 0, 4)
    || !Array.isArray(value.hints) || value.hints.length > 4
    || !Array.isArray(value.checkpoints) || value.checkpoints.length > 4) invalid();
  const hints = value.hints.map(decodeHintField);
  if (new Set(hints.map(h => h.slot)).size !== hints.length) invalid();
  const checkpoints = value.checkpoints.map((item: unknown) => {
    if (!record(item) || !numberIn(item.revealedCount, 0, 4)
      || !validToken(item.progressionToken)) invalid();
    return { revealedCount: item.revealedCount as 0 | 1 | 2 | 3 | 4,
      progressionToken: item.progressionToken as string };
  });
  return { pitchNumber: value.pitchNumber as number,
    revealedCount: value.revealedCount as 0 | 1 | 2 | 3 | 4,
    hints, checkpoints };
}

function decodeRevealedHint(value: unknown): DailyHintResponse['hint'] {
  if (!record(value) || !validText(value.hintType) || !validText(value.hintLabel)
    || !validText(value.hintValue)) invalid();
  return {
    hintType: value.hintType as DailyHintResponse['hint']['hintType'],
    hintLabel: value.hintLabel as string, hintValue: value.hintValue as string,
  };
}

function decodeHintField(value: unknown): DailyAuthorizedHint {
  if (!record(value) || !numberIn(value.slot, 1, 4)
    || !validText(value.hintType) || !validText(value.hintLabel)
    || !validText(value.hintValue)) invalid();
  return { slot: value.slot as 1 | 2 | 3 | 4,
    hintType: value.hintType as DailyAuthorizedHint['hintType'],
    hintLabel: value.hintLabel as string, hintValue: value.hintValue as string };
}
function validText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 2048;
}
function validToken(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 4096;
}
function numberIn(value: unknown, min: number, max: number): boolean {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function invalid(): never { throw new CustomNineBrowserTransportError('invalid_response'); }
