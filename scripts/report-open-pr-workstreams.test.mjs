import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeWorkstreams, renderWorkstreams } from './report-open-pr-workstreams.mjs';

const pr = (number, base = 'main', head = 'agent-' + number) => ({
  number, base: { ref: base }, head: { ref: head },
});

test('identifies shared source paths only between independent main-target PRs', () => {
  const files = new Map([
    [10, ['apps/web/app/page.tsx', 'tasks/todo.md']],
    [11, ['apps/web/app/page.tsx', 'tasks/todo.md', 'packages/engine/src/game.ts']],
    [12, ['apps/web/app/page.tsx']],
    [13, ['packages/engine/src/game.ts']],
  ]);
  const result = analyzeWorkstreams(
    [pr(10), pr(11), pr(12, 'feature-parent'), pr(13)], files);
  assert.deepEqual(result.direct.map(p => p.number), [10, 11, 13]);
  assert.deepEqual(result.stacked.map(p => p.number), [12]);
  assert.deepEqual(result.collisions, [{
    a: 10, b: 11,
    source: ['apps/web/app/page.tsx'], coordination: ['tasks/todo.md'],
  }, {
    a: 11, b: 13,
    source: ['packages/engine/src/game.ts'], coordination: [],
  }]);
});

test('treats docs and AGENTS overlap as coordination rather than code', () => {
  const result = analyzeWorkstreams([pr(1), pr(2)], new Map([
    [1, ['AGENTS.md', 'docs/START-HERE.md']],
    [2, ['docs/START-HERE.md', 'AGENTS.md']],
  ]));
  assert.equal(result.collisions.length, 1);
  assert.deepEqual(result.collisions[0].source, []);
  assert.deepEqual(result.collisions[0].coordination, ['AGENTS.md', 'docs/START-HERE.md']);
});

test('report is deterministic with missing file sets and leaves review gates intact', () => {
  const rendered = renderWorkstreams([pr(5, 'stack-base'), pr(2)], new Map());
  assert.match(rendered, /direct to main: 1; stacked: 1/);
  assert.match(rendered, /#5: base stack-base/);
  assert.match(rendered, /exact-head CI, genuine independent review/);
  assert.match(rendered, /None detected/);
});
