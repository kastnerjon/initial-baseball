import { describe, expect, it, vi } from 'vitest';
import type { DailyPuzzleEditorialRecord } from '@initial-baseball/daily';
import { verifyPublishedLegacyPrimaryGameIdentity } from './serverLegacyPrimaryGameIdentity';

vi.mock('server-only', () => ({}));

const NOW = new Date('2026-11-07T12:00:00Z');
const DATE = '2026-11-05';
const AT = '2026-11-06T08:00:02.356Z';
const publication = {
  editorialRecordId: 'daily-2026-11-05-v1', puzzleDate: DATE,
  puzzleNumber: 193, publishedAt: AT,
};
const ids = Array.from({ length: 9 }, (_, i) => 'ibp_player_' + (i + 1));
const record: DailyPuzzleEditorialRecord = {
  id: publication.editorialRecordId,
  puzzleDate: DATE, puzzleNumber: 193, version: 1, revision: 3,
  status: 'published', selections: ids.map((canonicalPlayerId, i) => ({
    slot: i + 1, canonicalPlayerId, source: 'manual' as const,
  })),
  createdAt: AT, createdBy: 'admin', updatedAt: AT, updatedBy: 'admin',
  scheduledAt: AT, scheduledBy: 'admin', publishedAt: AT, publishedBy: 'admin',
  archivedAt: null, archivedBy: null,
};

describe('read-only verified historical primary gameplay identity', () => {
  it('returns only current authoritative roster-derived ID, never an editorial ID or private player IDs', async () => {
    const read = vi.fn(async () => record);
    const result = await verifyPublishedLegacyPrimaryGameIdentity(publication, read, NOW);
    expect(read).toHaveBeenCalledWith(DATE);
    expect(result).toMatchObject({
      puzzleDate: DATE, puzzleNumber: 193,
      puzzleId: expect.stringMatching(/^daily-2026-11-05-editorial-[0-9a-f]{8}$/),
    });
    expect(result.puzzleId).not.toBe(publication.editorialRecordId);
    expect(JSON.stringify(result)).not.toContain('ibp_player_');
    expect(JSON.stringify(result)).not.toContain('selections');
  });

  it('sorts canonical slots before deriving the identity without changing their persisted order', async () => {
    const first = await verifyPublishedLegacyPrimaryGameIdentity(
      publication, async () => record, NOW,
    );
    const shuffled = { ...record, selections: [...record.selections].reverse() };
    const second = await verifyPublishedLegacyPrimaryGameIdentity(
      publication, async () => shuffled, NOW,
    );
    expect(second.puzzleId).toBe(first.puzzleId);
    expect(shuffled.selections[0]!.slot).toBe(9);
    const altered = { ...record, selections: record.selections.map((selection, i) =>
      i === 0 ? { ...selection, canonicalPlayerId: 'ibp_changed_player' } : selection) };
    const other = await verifyPublishedLegacyPrimaryGameIdentity(
      publication, async () => altered, NOW,
    );
    expect(other.puzzleId).not.toBe(first.puzzleId);
  });

  it('rejects forged or unreleased publication evidence without calling the private reader', async () => {
    const read = vi.fn(async () => record);
    const bad = [
      { ...publication, puzzleDate: '2026-11-07' },
      { ...publication, puzzleDate: '2026-11-08' },
      { ...publication, puzzleDate: '2026-02-30' },
      { ...publication, puzzleNumber: 1 },
      { ...publication, editorialRecordId: 'daily-2026-11-05-editorial-12345678' },
      { ...publication, publishedAt: '2026-11-08T00:00:00Z' },
      { ...publication, publishedAt: 'invalid-timestamp' },
    ];
    for (const candidate of bad) {
      await expect(verifyPublishedLegacyPrimaryGameIdentity(
        candidate, read, NOW,
      )).rejects.toThrow('could not be verified');
    }
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects stale or altered authoritative records without returning a guessed identifier', async () => {
    const bad = [
      null, { ...record, status: 'scheduled' }, { ...record, status: 'archived' },
      { ...record, version: 2 }, { ...record, id: 'daily-2026-11-05-v2' },
      { ...record, puzzleDate: '2026-11-04' }, { ...record, puzzleNumber: 192 },
      { ...record, publishedAt: null }, { ...record, publishedAt: '2026-11-06T09:00:00Z' },
      { ...record, selections: record.selections.slice(0, 8) },
      { ...record, selections: record.selections.map((selection, i) =>
        i === 8 ? { ...selection, slot: 1 } : selection) },
      { ...record, selections: record.selections.map((selection, i) =>
        i === 8 ? { ...selection, canonicalPlayerId: ids[0]! } : selection) },
    ];
    for (const value of bad) {
      await expect(verifyPublishedLegacyPrimaryGameIdentity(
        publication, async () => value as DailyPuzzleEditorialRecord | null, NOW,
      )).rejects.toThrow('could not be verified');
    }
  });

  it('sanitizes provider failures, including secrets and hidden lineup content', async () => {
    await expect(verifyPublishedLegacyPrimaryGameIdentity(
      publication, async () => { throw new Error('SECRET_PLAYER_SELECTIONS'); }, NOW,
    )).rejects.toThrow('could not be verified');
  });
});
