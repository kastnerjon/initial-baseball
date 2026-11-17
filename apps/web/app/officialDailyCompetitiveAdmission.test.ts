import { describe, expect, it, vi } from 'vitest';
import type { DailyAtBatResult, DailyCompletedResult } from '@initial-baseball/shared';
import { createOfficialDailyCompetitiveAdmission } from './officialDailyCompetitiveAdmission';
import { A, B, DATE, ANSWER, SECRET, runtime, tokens, proofs } from './officialDailyCompetitive.testFixtures';
vi.mock('server-only', () => ({}));

const START = Date.parse('2026-11-06T12:00:00Z');
const WINDOW = 24 * 60 * 60 * 1000;
function fixture() {
  const rows = new Map<string, DailyAtBatResult>();
  const completed = new Map<string, DailyCompletedResult>();
  let now = START;
  let loseResponse = false;
  let loseCompletionResponse = false;
  const load = vi.fn((id: string) => runtime(id).getPublicPuzzle(DATE));
  const service = createOfficialDailyCompetitiveAdmission({
    secret: SECRET, progressionTokens: tokens, loadReleasedPuzzle: load,
    maximumAttemptAgeMs: WINDOW, now: () => new Date(now),
    atBats: { async insertIfAbsent(result) {
      const key = [result.puzzleId, result.attemptId, result.rulesetVersion, result.atBat.pitchNumber].join('/');
      const existing = rows.get(key);
      if (existing) return { status: 'existing', result: structuredClone(existing) };
      rows.set(key, structuredClone(result));
      if (loseResponse) { loseResponse = false; throw new Error('response lost'); }
      return { status: 'inserted', result };
    } },
    completions: { async insertIfAbsent(result) {
      const existing = completed.get(result.submissionId);
      if (existing) return { status: 'existing', result: structuredClone(existing) };
      completed.set(result.submissionId, structuredClone(result));
      if (loseCompletionResponse) { loseCompletionResponse = false; throw new Error('completion response lost'); }
      return { status: 'inserted', result };
    } },
  });
  return { service, rows, completed, load, setNow: (value: number) => { now = value; },
    loseNextResponse: () => { loseResponse = true; },
    loseNextCompletionResponse: () => { loseCompletionResponse = true; } };
}
async function play(id = A, hit = false) {
  const game = runtime(id);
  const boot = await game.getBootstrap(DATE);
  const first = await game.resolveAtBat({ progressionToken: boot.progressionToken,
    ...(hit ? { submittedPlayerId: ANSWER } : { giveUp: true }) });
  let token = first.progressionToken;
  for (let i = 2; i <= 9; i++) token = (await game.resolveAtBat({ progressionToken: token, giveUp: true })).progressionToken;
  return { first: first.progressionToken, complete: token, boot: boot.progressionToken };
}
describe('source-only exact-edition signed result admission', () => {
  it('admits completion-first delivery, derives points, and retries without duplicate rows', async () => {
    const f = fixture(), game = await play(A, true);
    expect(await f.service.submit(game.complete, A)).toEqual({ ok: true, status: 'created', completed: true });
    expect(f.rows.size).toBe(9);
    expect([...f.completed.values()][0]?.summary).toMatchObject({ points: 4, completed: true });
    expect(await f.service.submit(game.complete, A)).toEqual({ ok: true, status: 'existing', completed: true });
    expect(await f.service.submit(game.first, A)).toEqual({ ok: true, status: 'existing', completed: false });
    expect(f.completed.size).toBe(1);
  });
  it('keeps identical-roster sibling cohorts separate even with the same injected attempt ID', async () => {
    const f = fixture(), a = await play(A, true), b = await play(B);
    expect(await f.service.submit(a.complete, B)).toMatchObject({ ok: false, error: 'invalid_proof' });
    expect(f.load).not.toHaveBeenCalled();
    await f.service.submit(a.complete, A);
    await f.service.submit(b.complete, B);
    expect(f.rows.size).toBe(18);
    expect(f.completed.size).toBe(2);
    expect([...f.completed.values()].map(x => x.puzzleId).sort()).toEqual([A, B].sort());
  });
  it('rejects a competing complete fork after an accepted partial prefix', async () => {
    const f = fixture(), hit = await play(A, true), out = await play();
    await f.service.submit(hit.first, A);
    expect(await f.service.submit(out.complete, A)).toMatchObject({ ok: false, error: 'idempotency_conflict' });
    expect(f.rows.size).toBe(1);
    expect(f.completed.size).toBe(0);
    expect(await f.service.submit(hit.complete, A)).toMatchObject({ ok: true, completed: true });
  });
  it('admits only one of concurrent conflicting transcripts using atomic repository winners', async () => {
    const f = fixture(), hit = await play(A, true), out = await play();
    const results = await Promise.all([f.service.submit(hit.complete, A), f.service.submit(out.complete, A)]);
    expect(results.filter(x => x.ok)).toHaveLength(1);
    expect(results.filter(x => !x.ok)).toEqual([{ ok: false, error: 'idempotency_conflict' }]);
    expect(f.rows.size).toBe(9);
    expect(f.completed.size).toBe(1);
  });
  it('recovers after an at-bat insert succeeds but its response is lost', async () => {
    const f = fixture(), game = await play();
    f.loseNextResponse();
    await expect(f.service.submit(game.complete, A)).rejects.toThrow('response lost');
    expect(f.rows.size).toBe(1);
    expect(f.completed.size).toBe(0);
    expect(await f.service.submit(game.complete, A)).toMatchObject({ ok: true, completed: true });
    expect(f.rows.size).toBe(9);
  });
  it('accepts bounded delayed live delivery across Pacific midnight and rejects expiry', async () => {
    const f = fixture(), game = await play();
    f.setNow(START + WINDOW);
    expect(await f.service.submit(game.first, A)).toMatchObject({ ok: true });
    f.setNow(START + WINDOW + 1);
    expect(await f.service.submit(game.complete, A)).toMatchObject({ ok: false, error: 'invalid_proof' });
    expect(f.completed.size).toBe(0);
  });
  it('rejects future starts, invalid live-start dates, empty proof and tampering before lookup', async () => {
    const f = fixture(), game = await play(), proof = proofs.verify(game.first);
    for (const token of [game.boot, game.first + 'x',
      proofs.sign({ ...proof, startedAt: START + 60_001 }),
      proofs.sign({ ...proof, startedAt: START - WINDOW })]) {
      expect(await f.service.submit(token, A)).toMatchObject({ ok: false, error: 'invalid_proof' });
    }
    expect(f.load).not.toHaveBeenCalled();
    expect(f.rows.size).toBe(0);
  });
  it('rejects an unpublished or mismatched authoritative edition before writes', async () => {
    const f = fixture(), game = await play();
    const puzzle = await runtime(B).getPublicPuzzle(DATE);
    f.load.mockResolvedValueOnce(puzzle);
    expect(await f.service.submit(game.first, A)).toMatchObject({ ok: false });
    f.load.mockResolvedValueOnce({ ...puzzle, id: A, status: 'scheduled' });
    expect(await f.service.submit(game.first, A)).toMatchObject({ ok: false });
    expect(f.rows.size).toBe(0);
  });
  it('validates the whole signed transcript before persisting any prefix', async () => {
    const f = fixture(), game = await play(), proof = proofs.verify(game.complete);
    proof.atBats[8] = { ...proof.atBats[8]!, initials: 'WRONG' };
    expect(await f.service.submit(proofs.sign(proof), A)).toMatchObject({ ok: false });
    expect(f.rows.size).toBe(0);
    expect(f.completed.size).toBe(0);
  });
  it('rejects a fork at a later pitch without mixing accepted branches', async () => {
    const f = fixture(), game = runtime(A), boot = await game.getBootstrap(DATE);
    const first = await game.resolveAtBat({ progressionToken: boot.progressionToken, giveUp: true });
    const hit = await game.resolveAtBat({ progressionToken: first.progressionToken, submittedPlayerId: ANSWER });
    const out = await game.resolveAtBat({ progressionToken: first.progressionToken, giveUp: true });
    await f.service.submit(hit.progressionToken, A);
    expect(await f.service.submit(out.progressionToken, A)).toEqual({ ok: false, error: 'idempotency_conflict' });
    expect([...f.rows.values()].map(x => x.atBat.outcome)).toEqual(['K', 'HR']);
    expect(f.completed.size).toBe(0);
  });
  it('rejects mismatched inner progression before any row write', async () => {
    const f = fixture(), a = await play(A), b = await play(B);
    const proof = proofs.verify(a.complete);
    proof.progressionToken = proofs.verify(b.complete).progressionToken;
    expect(await f.service.submit(proofs.sign(proof), A)).toEqual({ ok: false, error: 'invalid_proof' });
    expect(f.rows.size).toBe(0);
  });
  it('retries a completed insert whose response was lost without adding a completion', async () => {
    const f = fixture(), game = await play();
    f.loseNextCompletionResponse();
    await expect(f.service.submit(game.complete, A)).rejects.toThrow('completion response lost');
    expect(f.completed.size).toBe(1);
    expect(await f.service.submit(game.complete, A)).toEqual({ ok: true, status: 'existing', completed: true });
    expect(f.rows.size).toBe(9);
    expect(f.completed.size).toBe(1);
  });
});
