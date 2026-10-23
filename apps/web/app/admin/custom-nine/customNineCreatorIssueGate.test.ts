import { describe, expect, it, vi } from 'vitest';
import { createCustomNineCreatorIssueGate } from './customNineCreatorIssueGate';

describe('Custom creator issue single-flight guard', () => {
  it('rejects a second submission before React can render its busy state', async () => {
    const gate = createCustomNineCreatorIssueGate();
    let resolve!: () => void;
    const pendingResponse = new Promise<void>(done => { resolve = done; });
    const issue = vi.fn(async () => { await pendingResponse; });

    const first = gate.run(issue);
    expect(issue).toHaveBeenCalledTimes(1);
    expect(await gate.run(issue)).toBe(false);
    expect(issue).toHaveBeenCalledTimes(1);

    resolve();
    expect(await first).toBe(true);
    expect(await gate.run(issue)).toBe(true);
    expect(issue).toHaveBeenCalledTimes(2);
  });

  it('releases the gate after an exception so a manual retry remains possible', async () => {
    const gate = createCustomNineCreatorIssueGate();
    await expect(gate.run(async () => { throw new Error('provider rejected'); }))
      .rejects.toThrow('provider rejected');
    expect(await gate.run(async () => {})).toBe(true);
  });
});
