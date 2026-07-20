import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_PREFIX = 'v1';
const MINIMUM_SECRET_LENGTH = 32;
const DAILY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type DailyProgressionClaims = {
  version: 1;
  puzzleId: string;
  puzzleDate: string;
  pitchNumber: number;
  revealCount: 0 | 1 | 2 | 3 | 4;
  strikeCount: 0 | 1 | 2;
  outCount: 0 | 1 | 2 | 3;
  completed: boolean;
};

export type DailyProgressionTokenCodec = {
  sign: (claims: DailyProgressionClaims) => string;
  verify: (token: string) => DailyProgressionClaims;
};

export class DailyProgressionTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyProgressionTokenError';
  }
}

export function createDailyProgressionTokenCodec(secret: string): DailyProgressionTokenCodec {
  if (secret.length < MINIMUM_SECRET_LENGTH) {
    throw new Error(`Daily progression secret must be at least ${MINIMUM_SECRET_LENGTH} characters.`);
  }

  return {
    sign(claims) {
      const validatedClaims = requireDailyProgressionClaims(claims);
      const payload = encodeBase64Url(JSON.stringify(validatedClaims));
      const signingInput = `${TOKEN_PREFIX}.${payload}`;
      return `${signingInput}.${sign(signingInput, secret)}`;
    },
    verify(token) {
      const parts = token.split('.');
      if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
        throw new DailyProgressionTokenError('Invalid Daily progression token format.');
      }

      const [, payload, providedSignature] = parts;
      if (!payload || !providedSignature || !isCanonicalBase64Url(payload) || !isCanonicalBase64Url(providedSignature)) {
        throw new DailyProgressionTokenError('Invalid Daily progression token encoding.');
      }

      const signingInput = `${TOKEN_PREFIX}.${payload}`;
      const expectedSignature = sign(signingInput, secret);
      if (!safeEqual(providedSignature, expectedSignature)) {
        throw new DailyProgressionTokenError('Invalid Daily progression token signature.');
      }

      try {
        return requireDailyProgressionClaims(JSON.parse(decodeBase64Url(payload)) as unknown);
      } catch (error) {
        if (error instanceof DailyProgressionTokenError) {
          throw error;
        }
        throw new DailyProgressionTokenError('Invalid Daily progression token payload.');
      }
    },
  };
}

function requireDailyProgressionClaims(value: unknown): DailyProgressionClaims {
  if (!isRecord(value)) {
    throw new DailyProgressionTokenError('Daily progression claims must be an object.');
  }

  const claims = value as Record<string, unknown>;
  if (
    claims.version !== 1
    || typeof claims.puzzleId !== 'string'
    || claims.puzzleId.length === 0
    || claims.puzzleId.length > 200
    || typeof claims.puzzleDate !== 'string'
    || !DAILY_DATE_PATTERN.test(claims.puzzleDate)
    || !isRangeInteger(claims.pitchNumber, 1, 9)
    || !isRangeInteger(claims.revealCount, 0, 4)
    || !isRangeInteger(claims.strikeCount, 0, 2)
    || !isRangeInteger(claims.outCount, 0, 3)
    || typeof claims.completed !== 'boolean'
    || (!claims.completed && claims.outCount === 3)
  ) {
    throw new DailyProgressionTokenError('Daily progression token claims are invalid.');
  }

  return {
    version: 1,
    puzzleId: claims.puzzleId,
    puzzleDate: claims.puzzleDate,
    pitchNumber: claims.pitchNumber,
    revealCount: claims.revealCount as DailyProgressionClaims['revealCount'],
    strikeCount: claims.strikeCount as DailyProgressionClaims['strikeCount'],
    outCount: claims.outCount as DailyProgressionClaims['outCount'],
    completed: claims.completed,
  };
}

function sign(input: string, secret: string): string {
  return createHmac('sha256', secret).update(input).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'base64url');
  const rightBytes = Buffer.from(right, 'base64url');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function isCanonicalBase64Url(value: string): boolean {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return false;
  }
  return Buffer.from(value, 'base64url').toString('base64url') === value;
}

function isRangeInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
