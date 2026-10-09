export type LeaderboardIdentity = {
  puzzleId: string;
  puzzleDate: string;
  puzzleNumber: number;
  rulesetVersion: 'points-v4';
};

export type StoredLeaderboardCompletion = LeaderboardIdentity & { submissionId: string };

export type DailyNineLeaderboardRow = {
  displayName: string;
  points: number;
  rank: number;
  isOwnEntry: boolean;
  totalEntries: number;
};

export type DailyNineLeaderboardView = {
  totalEntries: number;
  leaders: Array<{ displayName: string; points: number; rank: number }>;
  ownEntry: { displayName: string; points: number; rank: number } | null;
};

export interface DailyNineLeaderboardRepository {
  findCompletion(submissionId: string): Promise<StoredLeaderboardCompletion | null>;
  insertName(submissionId: string, displayName: string): Promise<'created' | 'existing' | 'conflict'>;
  read(identity: LeaderboardIdentity, ownSubmissionId: string | null): Promise<DailyNineLeaderboardRow[]>;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: 'invalid_request' | 'not_eligible' | 'name_conflict' };

export function createDailyNineLeaderboardService(repository: DailyNineLeaderboardRepository) {
  return {
    async read(input: unknown): Promise<Result<DailyNineLeaderboardView>> {
      const identity = readIdentity(input);
      if (identity === null) return { ok: false, error: 'invalid_request' };
      return { ok: true, value: formatLeaderboard(await repository.read(identity, null)) };
    },
    async submit(input: unknown): Promise<Result<DailyNineLeaderboardView>> {
      const request = readSubmission(input);
      if (request === null) return { ok: false, error: 'invalid_request' };
      const completion = await repository.findCompletion(request.submissionId);
      if (completion === null || !eligibleCompletion(completion)) return { ok: false, error: 'not_eligible' };
      const status = await repository.insertName(request.submissionId, request.displayName);
      if (status === 'conflict') return { ok: false, error: 'name_conflict' };
      return { ok: true, value: formatLeaderboard(await repository.read(completion, request.submissionId)) };
    },
    async rank(input: unknown): Promise<Result<DailyNineLeaderboardView>> {
      const id = readSubmissionId(input);
      if (id === null) return { ok: false, error: 'invalid_request' };
      const completion = await repository.findCompletion(id);
      if (completion === null || !eligibleCompletion(completion)) return { ok: false, error: 'not_eligible' };
      return { ok: true, value: formatLeaderboard(await repository.read(completion, id)) };
    },
  };
}

function readIdentity(input: unknown): LeaderboardIdentity | null {
  if (!record(input)) return null;
  const { puzzleId, puzzleDate, puzzleNumber, rulesetVersion } = input;
  if (typeof puzzleId !== 'string' || puzzleId.length === 0 || puzzleId.length > 200
    || typeof puzzleDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate)
    || !Number.isFinite(Date.parse(puzzleDate + 'T00:00:00Z'))
    || new Date(puzzleDate + 'T00:00:00Z').toISOString().slice(0, 10) !== puzzleDate
    || typeof puzzleNumber !== 'number' || !Number.isSafeInteger(puzzleNumber)
    || puzzleNumber < 1 || rulesetVersion !== 'points-v4') return null;
  return { puzzleId, puzzleDate, puzzleNumber, rulesetVersion };
}

function eligibleCompletion(completion: StoredLeaderboardCompletion): boolean {
  return completion.rulesetVersion === 'points-v4'
    && !completion.puzzleId.startsWith('archive-beta-v1-daily-')
    && !completion.puzzleId.startsWith('permanent-v1-daily-');
}

function readSubmissionId(input: unknown): string | null {
  if (!record(input)) return null;
  return typeof input.submissionId === 'string'
    && /^[A-Za-z0-9_-]{1,128}$/.test(input.submissionId)
    ? input.submissionId : null;
}

function readSubmission(input: unknown): { submissionId: string; displayName: string } | null {
  if (!record(input)) return null;
  const id = readSubmissionId(input);
  if (id === null || typeof input.displayName !== 'string') return null;
  const name = input.displayName.trim();
  if (name.length < 1 || name.length > 32 || /[\x00-\x1f\x7f-\x9f]/.test(name)) return null;
  return { submissionId: id, displayName: name };
}

function formatLeaderboard(rows: readonly DailyNineLeaderboardRow[]): DailyNineLeaderboardView {
  const leaders = rows.slice(0, 10).filter(row => !row.isOwnEntry || rows.indexOf(row) < 10)
    .map(row => ({ displayName: row.displayName, points: row.points, rank: row.rank }));
  const own = rows.find(row => row.isOwnEntry);
  return {
    totalEntries: rows[0]?.totalEntries ?? 0,
    leaders,
    ownEntry: own === undefined ? null
      : { displayName: own.displayName, points: own.points, rank: own.rank },
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
