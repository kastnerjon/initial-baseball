#!/usr/bin/env node
/** Mounted production game with simulated transport; no hosted or cryptographic proof. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const web = fileURLToPath(new URL('../apps/web/', import.meta.url));
const req = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { JSDOM } = req('jsdom');
const { build } = createRequire(
  createRequire(req.resolve('vitest/package.json')).resolve('vite'),
)('esbuild');
const id = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const bundle = await build({
  stdin: {
    resolveDir: web,
    loader: 'tsx',
    contents: `
import React from 'react'; import { createRoot } from 'react-dom/client';
import { DailyInningGame } from './app/components/DailyInningGame';
import { DEFAULT_DAILY_HINT_CONFIG as config, DEFAULT_DAILY_STATS_HINT_CONFIG as stats } from '@initial-baseball/shared';
const puzzle = { id: '${id}', puzzleDate:'2026-11-06', puzzleNumber:194, status:'published', hintConfig:config, statsHintConfig:stats, pitches:Array.from({length:9},(_,i)=>({pitchNumber:i+1,initials:'PP'})) };
const hints=config.map(s=>({slot:s.slot,hintType:s.hintType,hintLabel:s.displayLabel,hintValue:'Fixture hint '+s.slot}));
const checkpoints=[1,2,3,4].map(revealedCount=>({revealedCount,progressionToken:'fixture-'+revealedCount}));
createRoot(document.getElementById('root')).render(<DailyInningGame puzzle={puzzle} rulesetVersion="points-v4" initialProgressionToken="fixture-0" initialHintBundle={{pitchNumber:1,revealedCount:0,hints,checkpoints}} officialEditionPractice />);`,
  },
  bundle: true,
  jsx: 'automatic',
  write: false,
  platform: 'browser',
  format: 'iife',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const hints = [
  ['main_decade', 'Era'],
  ['teams', 'Teams'],
  ['position', 'Position'],
  ['stats', 'Stats'],
].map(([hintType, hintLabel], i) => ({
  slot: i + 1,
  hintType,
  hintLabel,
  hintValue: 'Fixture hint ' + (i + 1),
}));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
for (const action of ['guess', 'giveup']) {
  const calls = [];
  let dom;
  async function mount(saved = {}) {
    dom = new JSDOM('<div id="root"></div>', {
      url: 'http://localhost/',
      runScripts: 'dangerously',
      pretendToBeVisual: true,
    });
    const w = dom.window;
    for (const [k, v] of Object.entries(saved)) w.localStorage.setItem(k, v);
    w.fetch = async (url, opts = {}) => {
      const path = String(url);
      const body = opts.body ? JSON.parse(opts.body) : null;
      calls.push({ path, body });
      if (path.endsWith('/hints')) {
        const depth = Number(body.progressionToken.split('-').at(-1));
        return new Response(
          JSON.stringify({
            hintBundle: {
              pitchNumber: 1,
              revealedCount: depth,
              hints,
              checkpoints: [1, 2, 3, 4]
                .filter((n) => n > depth)
                .map((revealedCount) => ({
                  revealedCount,
                  progressionToken: 'fixture-' + revealedCount,
                })),
            },
          }),
          { status: 200 },
        );
      }
      if (path.includes('/api/players/search'))
        return new Response(
          JSON.stringify({
            results: [
              { playerId: 'fixture-player', displayName: 'Fixture Player' },
            ],
          }),
          { status: 200 },
        );
      return new Response('{}', { status: 503 });
    };
    w.eval(bundle.outputFiles[0].text);
    return w;
  }
  let w = await mount();
  async function until(fn) {
    for (let i = 0; i < 120; i++) {
      let v = fn();
      if (v) return v;
      await delay(50);
    }
    throw Error('timeout ' + w.document.body.textContent.slice(0, 1000));
  }
  const button = (t) =>
    [...w.document.querySelectorAll('button')].find(
      (x) => x.textContent.trim() === t,
    );
  await until(() => button('Reveal Next Hint'));
  for (let i = 1; i <= 2; i++) {
    let n = calls.length;
    button('Reveal Next Hint').click();
    await until(() => w.document.body.textContent.includes(i + '/4 hints'));
    await delay(200);
    assert.equal(calls.length, n);
  }
  await until(() =>
    Object.values(w.localStorage).some((v) => {
      try {
        return JSON.parse(v)?.atBatState?.revealCount === 2;
      } catch {
        return false;
      }
    }),
  );
  const saved = Object.fromEntries(Object.entries(w.localStorage));
  dom.window.close();
  w = await mount(saved);
  await until(() => w.document.body.textContent.includes('2/4 hints'));
  const restores = calls.filter((x) => x.path.endsWith('/hints'));
  assert.equal(restores.length, 1);
  assert.equal(restores[0].path, `/api/daily/editions/${id}/hints`);
  assert.equal(restores[0].body.progressionToken, 'fixture-2');
  assert.equal(w.document.querySelectorAll('.revealed-hint').length, 2);
  for (let i = 3; i <= 4; i++) {
    let n = calls.length;
    button('Reveal Next Hint').click();
    await until(() => w.document.body.textContent.includes(i + '/4 hints'));
    await delay(200);
    assert.equal(calls.length, n);
  }
  if (action === 'guess') {
    const input = w.document.querySelector('input');
    Object.getOwnPropertyDescriptor(
      w.HTMLInputElement.prototype,
      'value',
    ).set.call(input, 'Fixture');
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
    await until(() => button('Fixture Player'));
    button('Fixture Player').click();
    await until(() => button('Submit Guess') && !button('Submit Guess').disabled);
    button('Submit Guess').click();
  } else {
    button('Give up').click();
    await until(() => button('Yes, give up'));
    button('Yes, give up').click();
  }
  await until(() => calls.some((x) => x.path.endsWith('/resolve')));
  const result = calls.find((x) => x.path.endsWith('/resolve'));
  assert.equal(result.path, `/api/daily/editions/${id}/resolve`);
  assert.equal(result.body.progressionToken, 'fixture-4');
  if (action === 'guess')
    assert.equal(result.body.submittedPlayerId, 'fixture-player');
  else assert.equal(result.body.giveUp, true);
  dom.window.close();
}
console.log(
  'PASS mounted edition: local hints, partial restore and checkpoint for guess and Give Up',
);
