import { describe, expect, it, vi } from 'vitest';
import { createCustomNineCreatorIssueGate } from './customNineCreatorIssueGate';

describe('Custom creator issue single-flight guard', () => {
  it('blocks concurrent and post-success duplicate issuance until explicit reset', async () => {
    const gate = createCustomNineCreatorIssueGate();
    let resolve!: (success: boolean) => void;
    const pendingResponse = new Promise<boolean>(done => { resolve = done; });
    const issue = vi.fn(async () => pendingResponse);

    const first = gate.run(issue);
    expect(issue).toHaveBeenCalledTimes(1);
    expect(await gate.run(issue)).toBe(false);
    gate.reset(); // an unrelated reset must not unlock an in-flight issuance
    expect(await gate.run(issue)).toBe(false);
    resolve(true);
    expect(await first).toBe(true);
    expect(await gate.run(issue)).toBe(false);
    expect(issue).toHaveBeenCalledTimes(1);

    gate.reset();
    expect(await gate.run(async () => true)).toBe(true);
  });

  it('releases the gate after rejection or throw, but latches a successful retry', async () => {
    const gate = createCustomNineCreatorIssueGate();
    expect(await gate.run(async () => false)).toBe(true);
    await expect(gate.run(async () => { throw new Error('provider rejected'); }))
      .rejects.toThrow('provider rejected');
    expect(await gate.run(async () => true)).toBe(true);
    expect(await gate.run(async () => true)).toBe(false);
    gate.reset();
    expect(await gate.run(async () => true)).toBe(true);
  });
});
