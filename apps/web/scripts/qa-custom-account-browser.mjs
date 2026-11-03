#!/usr/bin/env node
// QA-only, browser-level account/ownership/guest regression.
// Uses Supabase Admin to generate *synthetic email OTPs*, not Google credentials.
// The admin key never enters browser scripts, request headers or test output.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { assertCustomAccountQaEnvironment } from './qa-custom-account-safety.mjs';

const env = process.env;
assertCustomAccountQaEnvironment(env);
assert.equal(env.CUSTOM_V2_QA_ACCOUNT_ACCEPTANCE, 'true', 'Explicit QA-only acceptance opt-in required');
assert.ok(env.CUSTOM_V2_QA_PLAYWRIGHT_MODULE, 'Pinned Playwright module required');
const fixtureIds = env.CUSTOM_V2_QA_PLAYER_IDS.split(',');
assert.equal(new Set(fixtureIds).size, 10);
const webRoot = fileURLToPath(new URL('../', import.meta.url));
const nextBinary = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {persistSession:false, autoRefreshToken:false},
});
const { chromium } = await import(env.CUSTOM_V2_QA_PLAYWRIGHT_MODULE);
let server;
let browser;
const fixtureEmails = {
  owner:'qa-robot-owner-initial-baseball@example.com',
  friend:'qa-robot-friend-initial-baseball@example.com',
};
const testName = 'QA account browser regression ' + Date.now();

async function freePort() {
  const s=createServer();
  await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve);});
  const address=s.address();
  assert.ok(address&&typeof address!=='string');
  await new Promise((resolve,reject)=>s.close(err=>err?reject(err):resolve()));
  return address.port;
}
async function start() {
  const port=await freePort();
  const base=new URL('http://localhost:'+port);
  const child=spawn(process.execPath,[nextBinary,'start','-H','127.0.0.1','-p',String(port)],{
    cwd:webRoot, stdio:['ignore','pipe','pipe'],
    env:{
      ...env, PORT:String(port), HOSTNAME:'127.0.0.1',
      VERCEL:'1', VERCEL_ENV:'preview',
      CREATOR_AUTH_ENABLED:'true', CREATOR_AUTH_SITE_URL:base.origin,
      CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED:'true',
      CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED:'true',
      DAILY_PROGRESSION_SECRET:randomBytes(32).toString('hex'),
      CUSTOM_LINEUP_CREATION_BUDGET_SECRET:randomBytes(32).toString('hex'),
    },
  });
  // Consume server logs but do not echo them: secrets, IDs and hints stay private.
  child.stdout.resume();child.stderr.resume();
  for(let i=0;i<160;i++){
    if(child.exitCode!==null) break;
    try{const res=await fetch(base,{signal:AbortSignal.timeout(1200)});
      if(res.status===200)return {child,base};}catch{}
    await delay(250);
  }
  child.kill('SIGTERM');throw Error('QA localhost Next server did not become healthy');
}
async function jsonResponse(res,expected) {
  assert.equal(res.status(),expected,'Unexpected HTTP status');
  return res.json();
}
async function login(context,base,email){
  const {data,error}=await admin.auth.admin.generateLink({type:'magiclink',email});
  assert.ifError(error);
  assert.match(data?.properties?.email_otp??'',/^[0-9]{6}$/,
    'QA Supabase Auth did not issue a six-digit test OTP');
  // Use the same server-side OTP verification route as real email sign-in.
  // Do not print a token or URL. Browser context shares cookies with request.
  const response=await context.request.post(new URL('/api/account/auth/verify',base).href,{
    headers:{origin:base.origin},
    form:{email,token:data.properties.email_otp},
    maxRedirects:0,
  });
  assert.equal(response.status(),303,'QA email OTP sign-in failed');
  assert.equal(new URL(response.headers().location).pathname,'/account');
  assert.equal(new URL(response.headers().location).search,'',
    'QA email OTP was rejected');
  const session=await jsonResponse(
    await context.request.get(new URL('/api/account/session',base).href),200);
  assert.match(session.accountId??'',/^[a-f0-9-]{36}$/);
  assert.equal(session.accountId,data.user.id,'Different account was verified');
  return session.accountId;
}
function attempt(base,id,action) {
  return new URL('/api/custom-lineup/challenges/'+id+'/attempt/'+action,base).href;
}
async function bootstrap(context,base,id,mode){
  const res=await context.request.post(attempt(base,id,'bootstrap'),{headers:{origin:base.origin}});
  const data=await jsonResponse(res,200);
  assert.equal(data.attemptMode,mode,'Unexpected creator/guest mode');
  return data;
}
const running=await start();
server=running.child;
const base=running.base;
try {
  browser=await chromium.launch({headless:true});
  const owner=await browser.newContext({serviceWorkers:'block'});
  const ownerPage=await owner.newPage();
  await ownerPage.goto(new URL('/account',base).href);
  await ownerPage.getByText('Continue with Google').waitFor({
    state:'visible', timeout:10000,
  });
  const guest=await browser.newContext({serviceWorkers:'block'});
  assert.deepEqual(await jsonResponse(
    await guest.request.get(new URL('/api/account/session',base).href),200),
    {accountId:null},'Guest accidentally carried an auth session');
  assert.equal((await guest.request.get(new URL('/api/account/creations',base).href)).status(),401);

  const ownerId=await login(owner,base,fixtureEmails.owner);
  await ownerPage.reload();
  await ownerPage.getByText('Signed in.',{exact:false}).waitFor();
  const ip='192.0.2.'+(10+randomBytes(1)[0]%200);
  const issued=await jsonResponse(
    await owner.request.post(new URL('/api/custom-lineup/create',base).href,{
      headers:{origin:base.origin,'x-forwarded-for':ip,'x-vercel-forwarded-for':ip},
      data:{title:testName,canonicalPlayerIds:[fixtureIds[0]]},
    }),201);
  assert.deepEqual(Object.keys(issued),['puzzleId'],
    'Creation must not leak owner secret or hidden player IDs');
  const id=issued.puzzleId;
  assert.match(id,/^custom-lineup-v2-[0-9a-f-]{36}$/);

  const ownerCreations=await jsonResponse(
    await owner.request.get(new URL('/api/account/creations',base).href),200);
  assert.ok(ownerCreations.creations.some(x=>x.puzzleId===id&&x.displayTitle===testName),
    'Owner cannot retrieve new challenge');
  await bootstrap(owner,base,id,'creator_preview');
  const ownerSubmit=await owner.request.post(attempt(base,id,'submit'),{headers:{origin:base.origin}});
  assert.equal(ownerSubmit.status(),403,'Creator could submit competitively');
  const ownerGame=await owner.newPage();
  await ownerGame.goto(new URL('/custom/'+id,base).href);
  await ownerGame.getByText('Your lineup is locked').waitFor();

  // Second browser, SAME verified account: no creator cookie, still excluded.
  const owner2=await browser.newContext({serviceWorkers:'block'});
  assert.equal(await login(owner2,base,fixtureEmails.owner),ownerId);
  await bootstrap(owner2,base,id,'creator_preview');
  assert.equal((await owner2.request.post(attempt(base,id,'submit'),{
    headers:{origin:base.origin}})).status(),403);
  const owner2Creations=await jsonResponse(
    await owner2.request.get(new URL('/api/account/creations',base).href),200);
  assert.ok(owner2Creations.creations.some(x=>x.puzzleId===id));

  // Independent guest: no account, full competitive first attempt, idempotent admission.
  // Avoid racing two independent first bootstraps before either cookie is stored.
  const guestPage=await guest.newPage();
  const opening=await bootstrap(guest,base,id,'reserved');
  assert.equal(opening.atBats.length,1);
  assert.ok(!JSON.stringify(opening).includes(fixtureIds[0]),
    'Unrevealed answer leaked into guest bootstrap');
  const resolved=await jsonResponse(await guest.request.post(attempt(base,id,'resolve'),{
    headers:{origin:base.origin},
    data:{progressionToken:opening.progressionToken,submittedPlayerId:fixtureIds[0]},
  }),200);
  assert.equal(resolved.kind,'terminal');
  assert.equal(resolved.result.outcome,'HR');
  assert.equal(resolved.completed,true);
  assert.deepEqual(await jsonResponse(await guest.request.post(attempt(base,id,'submit'),{
    headers:{origin:base.origin}}),201),{status:'created'});
  assert.deepEqual(await jsonResponse(await guest.request.post(attempt(base,id,'submit'),{
    headers:{origin:base.origin}}),200),{status:'existing'});
  await guestPage.goto(new URL('/custom/'+id,base).href);
  await guestPage.getByText('Lineup complete').waitFor();

  // Different authenticated account remains eligible as a player, not an owner.
  const friend=await browser.newContext({serviceWorkers:'block'});
  const friendId=await login(friend,base,fixtureEmails.friend);
  assert.notEqual(friendId,ownerId,'QA friend and owner identities must differ');
  const friendCreations=await jsonResponse(
    await friend.request.get(new URL('/api/account/creations',base).href),200);
  assert.ok(!friendCreations.creations.some(x=>x.puzzleId===id),
    'Different account could enumerate private ownership');
  const friendOpening=await bootstrap(friend,base,id,'reserved');
  assert.equal(friendOpening.atBats.length,1);
  const friendResolved=await jsonResponse(await friend.request.post(attempt(base,id,'resolve'),{
    headers:{origin:base.origin},
    data:{progressionToken:friendOpening.progressionToken,giveUp:true},
  }),200);
  assert.equal(friendResolved.result.outcome,'K');
  assert.deepEqual(await jsonResponse(await friend.request.post(attempt(base,id,'submit'),{
    headers:{origin:base.origin}}),201),{status:'created'});

  // A signed-out creator must not retain access to creator metadata.
  const signout=await owner2.request.post(new URL('/api/account/auth/signout',base).href,{
    headers:{origin:base.origin},maxRedirects:0,
  });
  assert.equal(signout.status(),303);
  assert.deepEqual(await jsonResponse(
    await owner2.request.get(new URL('/api/account/session',base).href),200),{accountId:null});
  assert.equal((await owner2.request.get(new URL('/api/account/creations',base).href)).status(),401);

  // Independent DB readback: only two admitted noncreator results; owner still fixed.
  const {data:issuedRow,error:ie}=await admin.from('custom_nine_issued_challenges')
    .select('creator_account_id').eq('puzzle_id',id).single();
  assert.ifError(ie);
  assert.equal(issuedRow.creator_account_id,ownerId);
  const {data:results,error:re}=await admin.from('custom_nine_completed_results')
    .select('summary').eq('challenge_id',id);
  assert.ifError(re);
  assert.equal(results.length,2,'Only friend and guest can have results');
  assert.deepEqual(results.map(r=>r.summary.points).sort((a,b)=>a-b),[0,4]);
  const {data:attempts,error:ae}=await admin.from('custom_nine_attempt_states')
    .select('creator_seen,status').eq('challenge_id',id);
  assert.ifError(ae);
  assert.equal(attempts.length,2);
  assert.ok(attempts.every(a=>a.status==='completed'&&!a.creator_seen));
  console.log('PASS isolated QA signed account -> immutable issue -> cross-browser owner exclusion -> guest/friend completion -> DB readback -> signout');
  console.log('SCOPE: local Next/Chromium against QA Supabase Auth and DB; NOT live Google OAuth, Vercel ingress or physical mobile QA');
} finally {
  if(browser) await browser.close();
  if(server) server.kill('SIGTERM');
}
