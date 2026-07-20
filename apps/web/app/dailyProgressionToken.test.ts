import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  DailyProgressionTokenError,
  createDailyProgressionTokenCodec,
  type DailyProgressionClaims,
} from './dailyProgressionToken';

const secret = 'daily-progression-test-secret-0123456789abcdef';
const claims: DailyProgressionClaims = {
  version: 1,
  puzzleId: 'daily-2026-07-20',
  puzzleDate: '2026-07-20',
  pitchNumber: 3,
  revealCount: 2,
  strikeCount: 1,
  outCount: 1,
  completed: false,
};

describe('Daily progression token codec', () => {
  it('round-trips validated public progression claims', () => {
    const codec = createDailyProgressionTokenCodec(secret);
    const token = codec.sign(claims);

    expect(codec.verify(token)).toEqual(claims);
    expect(token).not.toContain(claims.puzzleId);
    expect(token).not.toContain('player');
    expect(token).not.toContain(secret);
  });

  it('rejects payload and signature tampering', () => {
    const codec = createDailyProgressionTokenCodec(secret);
    const token = codec.sign(claims);
    const [prefix, payload, signature] = token.split('.') as [string, string, string];
    const tamperedPayload = `${payload.slice(0, -1)}${payload.endsWith('A') ? 'B' : 'A'}`;
    const tamperedSignature = `${signature.slice(0, -1)}${signature.endsWith('A') ? 'B' : 'A'}`;

    expect(() => codec.verify(`${prefix}.${tamperedPayload}.${signature}`)).toThrow(DailyProgressionTokenError);
    expect(() => codec.verify(`${prefix}.${payload}.${tamperedSignature}`)).toThrow(DailyProgressionTokenError);
  });

  it('rejects malformed encodings, unsupported versions, and invalid claims', () => {
    const codec = createDailyProgressionTokenCodec(secret);

    expect(() => codec.verify('not-a-token')).toThrow(DailyProgressionTokenError);
    expect(() => codec.verify('v2.payload.signature')).toThrow(DailyProgressionTokenError);
    expect(() => codec.verify(signRaw({ ...claims, pitchNumber: 10 }))).toThrow(DailyProgressionTokenError);
    expect(() => codec.verify(signRaw({ ...claims, completed: false, outCount: 3 }))).toThrow(DailyProgressionTokenError);
  });

  it('requires a sufficiently strong injected secret', () => {
    expect(() => createDailyProgressionTokenCodec('too-short')).toThrow(/at least 32 characters/);
  });
});

function signRaw(value: unknown): string {
  const payload = Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  const signingInput = `v1.${payload}`;
  const signature = createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}
