export interface DailyChatOpsLineupRequest {
  puzzleDate: string;
  canonicalPlayerIds: readonly string[];
  schedule: boolean;
}

export class DailyChatOpsRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyChatOpsRequestError';
  }
}

export function parseDailyChatOpsLineupRequest(value: unknown): DailyChatOpsLineupRequest {
  if (!isRecord(value)) throw new DailyChatOpsRequestError('A JSON object is required.');

  const puzzleDate = value.puzzleDate;
  const canonicalPlayerIds = value.canonicalPlayerIds;
  const schedule = value.schedule;

  if (typeof puzzleDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate)) {
    throw new DailyChatOpsRequestError('A valid puzzleDate is required.');
  }
  if (!Array.isArray(canonicalPlayerIds) || canonicalPlayerIds.length !== 9) {
    throw new DailyChatOpsRequestError('Exactly nine canonicalPlayerIds are required.');
  }
  const normalizedIds = canonicalPlayerIds.map(value => typeof value === 'string' ? value.trim() : '');
  if (normalizedIds.some(value => value.length === 0)) {
    throw new DailyChatOpsRequestError('Every canonical player ID must be a non-empty string.');
  }
  if (new Set(normalizedIds).size !== normalizedIds.length) {
    throw new DailyChatOpsRequestError('canonicalPlayerIds must be unique.');
  }
  if (typeof schedule !== 'boolean') {
    throw new DailyChatOpsRequestError('schedule must be true or false.');
  }

  return { puzzleDate, canonicalPlayerIds: normalizedIds, schedule };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
