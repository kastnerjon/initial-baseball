#!/usr/bin/env node
/**
 * Native Chromium request-to-lock recovery against actual competitive React,
 * browser fetch POSTs and navigator.locks. Synthetic loopback HTTP authority;
 * no signing secret, Supabase, hosted scoring or production feature activation.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createIsolationBrowserEnvironment, isIsolationFixtureRequestAllowed } from './qa-official-daily-isolation-safety.mjs';

const playwrightPath = process.env.OFFICIAL_DAILY_RECOVERY_QA_PLAYWRIGHT_MODULE;
assert.ok(playwrightPath && isAbsolute(playwrightPath) &&
  playwrightPath.endsWith('/playwright/index.mjs'),
  'Use external QA-only Playwright path for competitive recovery browser fixture');
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const web = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(join(web,'package.json'));
const { build } = createRequire(createRequire(require.resolve('vitest/package.json'))
  .resolve('vite/package.json'))('esbuild');
const entry = [
  "import React from 'react';",
  "import { createRoot } from 'react-dom/client';",
  "import { CompetitiveDailyGame } from './app/components/CompetitiveDailyGame';",
  "createRoot(document.getElementById('app')).render(React.createElement(CompetitiveDailyGame, { puzzleId: 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08', date: '2026-11-06' }));",
].join('\n');
const built = await build({ stdin: { contents: entry, resolveDir: web,
  sourcefile:'qa-competitive-recovery-entry.tsx',loader:'tsx' },
  bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic' });
const script = built.outputFiles[0].contents;
const executablePath = process.env.OFFICIAL_DAILY_RECOVERY_QA_CHROMIUM_EXECUTABLE;
assert.ok(!executablePath || isAbsolute(executablePath), 'Chromium executable must be absolute');
const chromiumEnv = { ...createIsolationBrowserEnvironment(process.env) };
// QA-only non-secret library and font settings for minimal Linux containers.
for(const key of ['LD_LIBRARY_PATH','FONTCONFIG_FILE','FONTCONFIG_PATH']){
  if(process.env[key])chromiumEnv[key]=process.env[key];
}
const ID = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const DATE = '2026-11-06';
const hintTypes = ['main_decade','teams','position','stats'];
const results = ['triple','double','single','walk'];
const puzzle = {
 id: ID, puzzleNumber: 194, puzzleDate: DATE, status: 'published',
 hintConfig: hintTypes.map((hintType,i)=>({slot:i+1,result:results[i],hintType,displayLabel:'Hint '+(i+1)})),
 statsHintConfig: {hitter:[],pitcher:[]},
 pitches: Array.from({length:9},(_,i)=>({pitchNumber:i+1,initials:'HP'})),
};
const bundle = (pitchNumber) => ({
 pitchNumber, revealedCount:0,
 hints: hintTypes.map((hintType,i)=>({slot:i+1,hintType,hintLabel:'Hint '+(i+1),hintValue:'Public clue '+(i+1)})),
 checkpoints: Array.from({length:4},(_,i)=>({revealedCount:i+1,progressionToken:'signed-pitch-'+pitchNumber+'-hint-'+(i+1)})),
});
const bootstrap = (pitchNumber=1) => ({
 puzzle,rulesetVersion:'points-v4', progressionToken:'signed-pitch-'+pitchNumber,
 hintBundle:bundle(pitchNumber),
});
let revision=0, scoreReads=0, bootReads=0, resolves=0;
const actions=[];
const fact={pitchNumber:1,initials:'HP',outcome:'K',hintsRevealed:0,wrongGuesses:0,resolution:'give_up'};
const scorecard=()=>({
 ...bootstrap(revision?2:1), revision, atBats:revision?[fact]:[],
 resolvedNames:revision?['Synthetic Player']:[],status:'active',strikeCount:0,
});
const server=createServer(async(req,res)=>{
  const path=(req.url||'').split('?')[0];
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET'&&path==='/') {
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end('<!doctype html><html><body><main id="app"></main><script src="/app.js"></script></body></html>');
    return;
  }
  if(req.method==='GET'&&path==='/app.js'){
    res.setHeader('Content-Type','text/javascript');res.end(script);return;
  }
  if(req.method==='POST'&&path.includes('/competitive/')) {
    let input='';
    for await (const chunk of req)input+=chunk;
    const action=path.split('/').at(-1);
    assert.equal(path, '/api/daily/editions/' + ID + '/competitive/' + action,
      'competitive HTTP request must target the exact fixture edition');
    actions.push(action);
    if(action==='scorecard') {
      scoreReads++;
      if(scoreReads===2){res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"unavailable"}');return;}
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(scorecard()));return;
    }
    if(action==='bootstrap') {
      bootReads++;
      // The first scorecard recovery and its bootstrap fallback both fail.
      res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"unavailable"}');return;
    }
    if(action==='resolve') {
      resolves++;
      const parsed=JSON.parse(input);
      assert.equal(parsed.giveUp,true,'only one user-initiated give-up should be sent');
      assert.equal(parsed.progressionToken,'signed-pitch-1');
      if(revision===0)revision=1; // model SQL accepting the write before response loss
      res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"unavailable"}');return;
    }
  }
  res.writeHead(404);res.end('Not found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
let browser;
try {
  browser=await chromium.launch({headless:true,env:chromiumEnv,
    ...(executablePath?{executablePath,args:['--no-sandbox','--disable-dev-shm-usage',
      '--disable-gpu','--use-gl=angle','--use-angle=swiftshader']}: {})});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await context.route('**/*',r=>isIsolationFixtureRequestAllowed(r.request().url(),base)
    ?r.continue():r.abort());
  const page=await context.newPage();

  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const nav=await page.goto(base,{waitUntil:'domcontentloaded'});
  assert.equal(nav?.status(),200,'Only loopback fixture should serve the game');
  await page.getByRole('button',{name:'Give Up'}).waitFor({timeout:20000});
  const initial=await page.locator('.at-bat-progress-step[aria-current="step"]').getAttribute('aria-label');
  const firstLock=await page.evaluate(()=>navigator.locks.query());
  assert.equal(firstLock.held.length,1,'initial gameplay must hold native exclusive Web Lock');
  assert.equal(firstLock.held[0].name,'official-daily-competitive:'+ID,'initial lock must be edition-scoped');
  assert.equal(firstLock.held[0].mode,'exclusive','initial lock must be exclusive');
  assert.equal(initial,'At-bat 1: current');
  await page.getByRole('button',{name:'Give Up'}).click();

  if(await page.getByRole('button',{name:/Confirm|Yes|Give Up/i}).count()>1) {
    const buttons=await page.getByRole('button').allTextContents();
    console.log('confirm buttons',buttons);
  }
  // Actual shared Give Up confirmation; no child component or fetch mocked.
  await page.getByRole('button',{name:'Yes, give up'}).click();
  await page.getByText('Your scorecard could not be opened.').waitFor({timeout:25000});
  await page.getByRole('button',{name:'Reload scorecard'}).waitFor({timeout:25000});

  assert.equal(revision,1);
  assert.equal(resolves,1,'lost response must not replay a competing give-up');
  assert.equal(scoreReads,2,'automatic scorecard recovery must attempt a real HTTP read');
  assert.equal(bootReads,1,'failed scorecard read must attempt bounded bootstrap fallback');
  // Even a failed scorecard + failed bootstrap must release the previous exclusive lock.
  await page.waitForFunction(async()=>{
    const locks=await navigator.locks.query();return locks.held.length===0&&locks.pending.length===0;
  },null,{timeout:10000});

  await page.getByRole('button',{name:'Reload scorecard'}).click();
  await page.locator('.at-bat-progress-step[aria-current="step"][aria-label="At-bat 2: current"]').waitFor({timeout:25000});
  const finalLock=await page.evaluate(()=>navigator.locks.query());
  assert.equal(finalLock.held.length,1,'recovered game must acquire one exclusive lock');
  assert.equal(finalLock.held[0].name,'official-daily-competitive:'+ID,'recovered lock must be edition-scoped');
  assert.equal(finalLock.held[0].mode,'exclusive','recovered lock must be exclusive');
  assert.equal(resolves,1,'manual reload must never replay failed action');
  assert.equal(scoreReads,3,'manual reload must re-read canonical scorecard');
  assert.equal(revision,1,'one authoritative score write only');
  assert.deepEqual(actions,['scorecard','resolve','scorecard','bootstrap','scorecard']);
  assert.deepEqual(errors,[],'no uncaught browser JavaScript errors');
  console.log('PASS Native Chromium competitive POST response loss, failed scorecard + bootstrap, exclusive Web Lock release, manual authoritative reload and reacquire, one accepted action');
  await context.close();
} finally {
 await browser?.close();
 await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
}
