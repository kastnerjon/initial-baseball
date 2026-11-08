import { createPermanentDailyIssuedClueSnapshot } from '@initial-baseball/daily';
import { DEFAULT_DAILY_HINT_CONFIG } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./materializePermanentDailyIssuedClueSnapshot', () => ({
  prepareServerOfficialDailyPublication: vi.fn(),
}));
vi.mock('./serverPrivateOfficialDailyPublicationReader', () => ({
  readPrivateOfficialDailyPublication: vi.fn(),
}));

import { prepareServerOfficialDailyPublication } from './materializePermanentDailyIssuedClueSnapshot';
import { readPrivateOfficialDailyPublication } from './serverPrivateOfficialDailyPublicationReader';
import { issuePrivateOfficialDaily, OfficialDailyIssueError } from './serverOfficialDailyIssuance';

const occurrenceId = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const puzzleId = 'daily-ed-v1-' + occurrenceId;
const selections = Array.from({ length: 9 }, (_, i) => ({
  slot: i + 1, canonicalPlayerId: 'fixture-' + (i + 1), source: 'manual',
}));
const snapshot = createPermanentDailyIssuedClueSnapshot({
  hintLayout: DEFAULT_DAILY_HINT_CONFIG,
  pitches: selections.map((s, index) => ({
    pitchNumber: index + 1, canonicalPlayerId: s.canonicalPlayerId,
    initials: 'AB', hintValues: ['1980s', 'NYM', 'CF', '3 HR'],
  })),
});
const editorial = {
  occurrence_id: occurrenceId, puzzle_date: '2026-11-06',
  puzzle_number: 194, edition_key: 'modern', edition_number: 2,
  title: 'Modern', selections, status: 'scheduled', revision: 1,
};
const frozen = {
  puzzleId, puzzleDate: editorial.puzzle_date, puzzleNumber: editorial.puzzle_number,
  editionKey: editorial.edition_key, editionNumber: editorial.edition_number,
  title: editorial.title, rulesetVersion: 'points-v4' as const, clueSnapshot: snapshot,
};

/** Simulate the private draft read and atomic publication RPC. */
function database(row: unknown = editorial) {
  const maybeSingle = vi.fn(async () => ({ data: row, error: null }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn(async () => ({
    data: [{ status: 'created', puzzle_id: puzzleId as string | null }], error: null,
  }));
  return { client: { from, rpc } as unknown as SupabaseClient, from, eq, rpc, maybeSingle };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prepareServerOfficialDailyPublication).mockReturnValue({
    schemaVersion: 1, puzzleId, puzzleDate: '2026-11-06',
    puzzleNumber: 194, editionKey: 'modern', editionNumber: 2,
    title: 'Modern', rulesetVersion: 'points-v4', clueSnapshot: snapshot,
  });
  vi.mocked(readPrivateOfficialDailyPublication).mockResolvedValue(frozen);
});

describe('private atomic secondary Daily issuance', () => {
  it('issues with exact scheduled revision and verifies the frozen record', async () => {
    const db = database();
    expect(await issuePrivateOfficialDaily(db.client, occurrenceId, 1))
      .toEqual({ status: 'created', puzzleId });
    expect(prepareServerOfficialDailyPublication).toHaveBeenCalledWith(
      expect.objectContaining({
        occurrenceId, editionKey: 'modern',
        editorial: expect.objectContaining({ status: 'scheduled', selections }),
      }),
    );
    expect(db.rpc).toHaveBeenCalledWith('issue_official_daily_editorial_draft', {
      p_occurrence_id: occurrenceId, p_expected_revision: 1,
      p_clue_snapshot: snapshot,
    });
    expect(readPrivateOfficialDailyPublication).toHaveBeenCalledWith(db.client, puzzleId);
  });

  it('retries an issued draft using frozen clues without rematerialization', async () => {
    const db = database({ ...editorial, status: 'issued' });
    expect(await issuePrivateOfficialDaily(db.client, occurrenceId, 1))
      .toEqual({ status: 'existing', puzzleId });
    expect(prepareServerOfficialDailyPublication).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it('rejects invalid input, drafts and stale revisions before any issuance', async () => {
    const db = database();
    await expect(issuePrivateOfficialDaily(db.client, 'invalid-id', 1))
      .rejects.toThrowError(expect.objectContaining({ kind: 'invalid' }));
    await expect(issuePrivateOfficialDaily(db.client, occurrenceId, -1))
      .rejects.toThrowError(expect.objectContaining({ kind: 'invalid' }));
    await expect(issuePrivateOfficialDaily(db.client, occurrenceId, 0))
      .rejects.toThrowError(expect.objectContaining({ kind: 'conflict' }));
    const draft = database({ ...editorial, status: 'draft' });
    await expect(issuePrivateOfficialDaily(draft.client, occurrenceId, 1))
      .rejects.toThrowError(expect.objectContaining({ kind: 'conflict' }));
    expect(db.rpc).not.toHaveBeenCalled();
    expect(draft.rpc).not.toHaveBeenCalled();
  });

  it('rejects conflicting issuance without exposing private RPC details', async () => {
    const db = database();
    db.rpc.mockResolvedValueOnce({ data: [{ status: 'conflict', puzzle_id: null }], error: null });
    await expect(issuePrivateOfficialDaily(db.client, occurrenceId, 1))
      .rejects.toThrowError(expect.objectContaining({ kind: 'conflict' }));
  });

  it('refuses malformed or mismatched RPC acknowledgements before readback', async () => {
    const db = database();
    db.rpc.mockResolvedValueOnce({
      data: [{ status: 'created', puzzle_id: 'daily-ed-v1-00000000-0000-4000-8000-000000000099' }],
      error: null,
    });
    await expect(issuePrivateOfficialDaily(db.client, occurrenceId, 1))
      .rejects.toThrowError(expect.objectContaining({ kind: 'unavailable' }));
    expect(readPrivateOfficialDailyPublication).not.toHaveBeenCalled();
    db.rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(issuePrivateOfficialDaily(db.client, occurrenceId, 1))
      .rejects.toThrowError(expect.objectContaining({ kind: 'unavailable' }));
  });

  it('rejects a success-looking RPC when no matching frozen publication exists', async () => {
    const db = database();
    vi.mocked(readPrivateOfficialDailyPublication).mockResolvedValueOnce(null);
    await expect(issuePrivateOfficialDaily(db.client, occurrenceId, 1))
      .rejects.toThrowError(expect.objectContaining({ kind: 'unavailable' }));
    const wrong = { ...frozen, clueSnapshot: {
      ...snapshot, pitches: [...snapshot.pitches].reverse(),
    } };
    vi.mocked(readPrivateOfficialDailyPublication).mockResolvedValueOnce(wrong);
    await expect(issuePrivateOfficialDaily(db.client, occurrenceId, 1))
      .rejects.toThrowError(expect.objectContaining({ kind: 'unavailable' }));
  });

  it('rejects a forged issued draft whose frozen batting order differs', async () => {
    const db = database({ ...editorial, status: 'issued',
      selections: [...selections].reverse().map((s, index) => ({ ...s, slot: index + 1 })) });
    await expect(issuePrivateOfficialDaily(db.client, occurrenceId, 1))
      .rejects.toThrowError(expect.objectContaining({ kind: 'conflict' }));
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it('sanitizes provider errors containing canonical player IDs and hints', async () => {
    const db = database();
    db.rpc.mockRejectedValueOnce(new Error('private-fixture-1 future-stats-hint'));
    try {
      await issuePrivateOfficialDaily(db.client, occurrenceId, 1);
      throw new Error('Expected an unavailable error');
    } catch (error) {
      expect(error).toBeInstanceOf(OfficialDailyIssueError);
      expect(String(error)).not.toContain('private-fixture');
      expect((error as OfficialDailyIssueError).kind).toBe('unavailable');
    }
  });
});
