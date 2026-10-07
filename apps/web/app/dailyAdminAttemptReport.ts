import { getDailyAtBatPoints } from '@initial-baseball/engine';
import type { DailyAtBatResult, DailyCompletedResult } from '@initial-baseball/shared';

export const ADMIN_ATTEMPT_PAGE_SIZE = 50;
export type AdminAttemptFilter = { date: string; puzzleId: string; ruleset: 'points-v3' | 'points-v4'; abAfter: string; completedAfter: string };
export type AdminAtBatReceipt = { result: DailyAtBatResult; receivedAt: string };
export type AdminCompletionReceipt = { result: DailyCompletedResult; receivedAt: string };
export type AdminAttemptScore = { points: number; source: 'AB' | 'completion'; receivedAt: string | null };
export type AdminAttemptRow = {
  id: string; seedIdConvention: boolean; scores: (AdminAttemptScore | null)[];
  recordedAtBats: number; recordedPoints: number; completedPoints: number | null;
  firstReceived: string; lastReceived: string; warning: string | null;
};
export type AdminAttemptReport = { filter: AdminAttemptFilter; rows: AdminAttemptRow[]; next: AdminAttemptFilter | null };
export class AdminAttemptFilterError extends Error {}

export function readAdminAttemptFilter(params: URLSearchParams, defaultDate: string): AdminAttemptFilter {
  const date = params.get('date') ?? defaultDate;
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  const puzzleId = params.get('puzzleId')?.trim() ?? '';
  const ruleset = params.get('ruleset') ?? 'points-v4';
  const abAfter = params.get('abAfter') ?? '';
  const completedAfter = params.get('completedAfter') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0, 10) !== date
    || puzzleId.length > 200 || /[\x00-\x1f]/.test(puzzleId)
    || (ruleset !== 'points-v3' && ruleset !== 'points-v4')
    || [abAfter, completedAfter].some(cursor => cursor !== '' && !/^[A-Za-z0-9_-]{1,128}$/.test(cursor))) {
    throw new AdminAttemptFilterError('Choose a valid date, exact lineup ID and supported scoring version.');
  }
  return { date, puzzleId, ruleset, abAfter, completedAfter };
}

export function buildAdminAttemptReport(
  filter: AdminAttemptFilter, atBats: AdminAtBatReceipt[], completions: AdminCompletionReceipt[],
): AdminAttemptReport {
  const rows = new Map<string, AdminAttemptRow>();
  function rowFor(id: string, result: DailyAtBatResult | DailyCompletedResult, receivedAt: string) {
    if (result.puzzleId !== filter.puzzleId || result.puzzleDate !== filter.date
      || result.rulesetVersion !== filter.ruleset
      || !Number.isFinite(Date.parse(receivedAt))) throw new Error('Invalid admin result identity or receipt.');
    let row = rows.get(id);
    if (!row) {
      row = { id, seedIdConvention: filter.date === '2026-10-06' && filter.puzzleId === 'daily-2026-10-06-editorial-6aee324e'
        && filter.ruleset === 'points-v4' && id.startsWith('legacy_20261006_'), scores: Array(9).fill(null),
        recordedAtBats: 0, recordedPoints: 0, completedPoints: null,
        firstReceived: receivedAt, lastReceived: receivedAt, warning: null };
      rows.set(id, row);
    }
    if (Date.parse(receivedAt) < Date.parse(row.firstReceived)) row.firstReceived = receivedAt;
    if (Date.parse(receivedAt) > Date.parse(row.lastReceived)) row.lastReceived = receivedAt;
    return row;
  }
  for (const { result, receivedAt } of atBats) {
    const row = rowFor(result.attemptId, result, receivedAt);
    const index = result.atBat.pitchNumber - 1;
    if (index < 0 || index > 8 || row.scores[index]) throw new Error('Invalid or duplicate admin AB slot.');
    row.scores[index] = { points: result.awardedPoints, source: 'AB', receivedAt };
    row.recordedAtBats += 1;
    row.recordedPoints += result.awardedPoints;
  }
  for (const { result, receivedAt } of completions) {
    const row = rowFor(result.submissionId, result, receivedAt);
    if (!('points' in result.summary) || row.completedPoints !== null
      || result.completedAtBats.length !== 9
      || result.completedAtBats.some((fact, i) => fact.pitchNumber !== i + 1)) {
      throw new Error('Invalid admin completion.');
    }
    row.completedPoints = result.summary.points;
    let derivedTotal = 0;
    for (const fact of result.completedAtBats) {
      const points = getDailyAtBatPoints({ ...fact, rulesetVersion: result.rulesetVersion });
      derivedTotal += points;
      const existing = row.scores[fact.pitchNumber - 1];
      if (existing && existing.points !== points) row.warning = 'AB and completed facts disagree.';
      if (!existing) row.scores[fact.pitchNumber - 1] = { points, source: 'completion', receivedAt: null };
    }
    if (derivedTotal !== row.completedPoints) row.warning = 'Completed total and facts disagree.';
  }
  const ordered = [...rows.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { filter, rows: ordered, next: null };
}

export function adminAttemptReportHref(filter: AdminAttemptFilter, csv = false): string {
  const params = new URLSearchParams(filter);
  return `/admin/daily/attempts${csv ? '/export' : ''}?${params}`;
}

export function adminAttemptReportCsv(report: AdminAttemptReport): string {
  const header = ['attempt_id', 'puzzle_date', 'puzzle_id', 'ruleset', 'seed_id_convention',
    ...Array.from({ length: 9 }, (_, i) => `AB${i + 1}`),
    ...Array.from({ length: 9 }, (_, i) => `AB${i + 1}_source`),
    ...Array.from({ length: 9 }, (_, i) => `AB${i + 1}_received_utc`),
    'received_ABs', 'received_AB_points', 'completed_points', 'first_received_utc', 'last_received_utc', 'warning'];
  const data = report.rows.map(row => [row.id, report.filter.date, report.filter.puzzleId,
    report.filter.ruleset, row.seedIdConvention, ...row.scores.map(score => score?.points ?? ''),
    ...row.scores.map(score => score?.source ?? ''), ...row.scores.map(score => score?.receivedAt ?? ''),
    row.recordedAtBats, row.recordedPoints, row.completedPoints ?? '', row.firstReceived, row.lastReceived, row.warning ?? '']);
  return [header, ...data].map(row => row.map(value => {
    const text = String(value);
    const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  }).join(',')).join('\r\n') + '\r\n';
}
