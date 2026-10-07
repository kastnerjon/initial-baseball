import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DailyAtBatResult, DailyCompletedResult } from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import { adminAttemptReportCsv, buildAdminAttemptReport, readAdminAttemptFilter } from './dailyAdminAttemptReport';
import { DailyAttemptScoresView } from './admin/daily/attempts/DailyAttemptScoresView';

const filter = readAdminAttemptFilter(new URLSearchParams('puzzleId=edition-b'), '2026-10-06');
const receivedAt = '2026-10-07T01:02:10Z';
function ab(id: string, pitchNumber = 1, points = 0): DailyAtBatResult {
  return { schemaVersion: 1, attemptId: id, puzzleId: filter.puzzleId, puzzleDate: filter.date,
    puzzleNumber: 163, rulesetVersion: 'points-v4', awardedPoints: points,
    atBat: { pitchNumber, initials: 'TR', outcome: 'K', hintsRevealed: 4, wrongGuesses: 0, resolution: 'give_up' } };
}
function completion(id: string): DailyCompletedResult {
  return { schemaVersion: 1, submissionId: id, puzzleId: filter.puzzleId, puzzleDate: filter.date,
    puzzleNumber: 163, rulesetVersion: 'points-v4',
    completedAtBats: Array.from({ length: 9 }, (_, i) => ({ pitchNumber: i + 1, initials: 'TR', outcome: 'BB' as const, hintsRevealed: 4 as const, wrongGuesses: 0, resolution: 'correct' as const })),
    summary: { points: 4.5, maximumPoints: 36, atBatsCompleted: 9, totalAtBats: 9, completed: true, strikeouts: 0 } };
}
describe('Admin attempt report', () => {
  it('preserves zero, missing, partial points, exact IDs and receipt times', () => {
    const report = buildAdminAttemptReport(filter, [{ result: ab('native'), receivedAt }], []);
    expect(report.rows[0]).toMatchObject({ id: 'native', recordedAtBats: 1, recordedPoints: 0, completedPoints: null, seeded: false });
    expect(report.rows[0]!.scores[0]).toEqual({ points: 0, source: 'AB', receivedAt });
    expect(report.rows[0]!.scores[1]).toBeNull();
  });
  it('joins only equal attempt/submission IDs and marks completion-only scores', () => {
    const report = buildAdminAttemptReport(filter, [{ result: ab('same', 1, 0.5), receivedAt }], [
      { result: completion('same'), receivedAt }, { result: completion('different'), receivedAt },
    ]);
    expect(report.rows).toHaveLength(2);
    const same = report.rows.find(row => row.id === 'same')!;
    expect(same.scores[0]!.source).toBe('AB');
    expect(same.scores[1]).toEqual({ points: 0.5, source: 'completion', receivedAt: null });
    expect(same.completedPoints).toBe(4.5);
    expect(same.warning).toBeNull();
    expect(report.rows[0]!.recordedAtBats).toBe(0);
  });
  it('never combines another edition/date/ruleset and rejects duplicate slots', () => {
    for (const result of [{ ...ab('a'), puzzleId: 'edition-a' }, { ...ab('a'), puzzleDate: '2026-10-05' }, { ...ab('a'), rulesetVersion: 'points-v3' as const }]) {
      expect(() => buildAdminAttemptReport(filter, [{ result, receivedAt }], [])).toThrow();
    }
    expect(() => buildAdminAttemptReport(filter, [{ result: ab('a'), receivedAt }, { result: ab('a'), receivedAt }], [])).toThrow();
  });
  it('flags disagreements rather than silently rewriting recorded points', () => {
    const report = buildAdminAttemptReport(filter, [{ result: ab('a', 1, 4), receivedAt }], [{ result: completion('a'), receivedAt }]);
    expect(report.rows[0]!.scores[0]!.points).toBe(4);
    expect(report.rows[0]!.warning).toMatch(/disagree/);
  });
  it('uses the engine for historical points rather than v4 outcome mapping', () => {
    const historical = { ...filter, ruleset: 'points-v3' as const };
    const result = completion('old');
    result.rulesetVersion = 'points-v3';
    if ('points' in result.summary) { result.summary.points = 27; result.summary.maximumPoints = 63; }
    const report = buildAdminAttemptReport(historical, [], [{ result, receivedAt }]);
    expect(report.rows[0]!.scores[0]!.points).toBe(3);
  });
  it('validates calendar dates, supported rules and both cursors', () => {
    for (const query of ['date=2026-02-30', 'ruleset=classic-inning-v1', 'abAfter=bad!', 'completedAfter=bad!', `puzzleId=${'a'.repeat(201)}`]) {
      expect(() => readAdminAttemptFilter(new URLSearchParams(query), filter.date)).toThrow();
    }
  });
  it('exports sources, missing blanks, half-points and formula-safe quoted cells', () => {
    const malicious = { ...filter, puzzleId: '=HYPERLINK("bad")' };
    const result = { ...completion('legacy_20261006_test'), puzzleId: malicious.puzzleId };
    const csv = adminAttemptReportCsv(buildAdminAttemptReport(malicious, [], [{ result, receivedAt }]));
    expect(csv).toContain('"AB1_received_utc"');
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"0.5","0.5"');
    expect(csv).toContain('"completion"');
    expect(csv).toContain('"true"');
    expect(csv).toContain('"0","0","4.5"');
  });
  it('renders a private scrollable table with AB headers and distinct source labels', () => {
    const report = buildAdminAttemptReport(filter, [{ result: ab('native'), receivedAt }], [{ result: completion('legacy_20261006_seed'), receivedAt }]);
    const html = renderToStaticMarkup(<DailyAttemptScoresView report={report} />);
    expect(html).toContain('AB 9');
    expect(html).toContain('overflow-x:auto');
    expect(html).toContain('Seeded beta');
    expect(html).toContain('0.5†');
    expect(html).toContain('>0</td>');
    expect(html).toContain('>—</td>');
    expect(html).toContain('Export this page as CSV');
    expect(html).toContain('9:02:10 PM');
  });
});
