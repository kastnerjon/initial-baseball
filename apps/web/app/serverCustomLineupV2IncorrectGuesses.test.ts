import { describe, expect, it, vi } from 'vitest';
import { createCustomLineupIssuedChallenge, createCustomLineupIssuedClueSnapshot } from '@initial-baseball/daily';
import type { Player } from '@initial-baseball/shared';
import type { CanonicalPlayerReveal } from '@initial-baseball/baseball-data/runtime';
vi.mock('server-only', () => ({}));
import { createCustomLineupV2AttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { createCustomLineupV2CreatorBrowserMarker } from './customNineCreatorBrowser';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';
import { createCustomLineupV2ProgressionTokens } from './serverCustomLineupV2Bootstrap';
import { createCustomNineProgressionTokens, CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import { createServerCustomLineupV2IncorrectGuessService } from './serverCustomLineupV2IncorrectGuesses';

const ID='custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const SECRET='secure-v2-incorrect-credential-secret-with-more-than-32-characters';
const TOKENS=createCustomLineupV2ProgressionTokens(SECRET);
const IDS=Array.from({length:10},(_,i)=>'ibp_'+(i+1).toString(16).padStart(20,'0'));
const CLAIMS={version:1 as const,rulesetVersion:'points-v4' as const,puzzleId:ID,
  puzzleDate:CUSTOM_NINE_SESSION_DATE,pitchNumber:1,revealCount:0 as const,
  strikeCount:0 as const,outCount:0 as const,completed:false};
const INITIAL=TOKENS.sign(CLAIMS);
const issued=createCustomLineupV2AttemptBrowserCredential(SECRET).issue(ID,'https://test.example');
const COOKIE=issued.setCookie.split(';')[0]!;
function challenge(n:number,cap:1|2|3=3) {
 return createCustomLineupIssuedChallenge({puzzleId:ID,issuedAt:'2026-10-14T12:00:00Z',strikeLimit:cap,
  canonicalPlayerIds:IDS.slice(0,n),
  clueSnapshot:createCustomLineupIssuedClueSnapshot({
   hintLayout:[
    {slot:1,hintType:'main_decade',displayLabel:'Decade'},
    {slot:2,hintType:'teams',displayLabel:'Teams'},
    {slot:3,hintType:'position',displayLabel:'Position'},
    {slot:4,hintType:'stats',displayLabel:'Stats'}],
   pitches:IDS.slice(0,n).map((canonicalPlayerId,i)=>({
    pitchNumber:i+1,canonicalPlayerId,initials:'P'+(i+1),
    hintValues:['decade','teams','position','stats'].map(()=>i?'PRIVATE_FUTURE_HINT':'PRIVATE_HINT'),
   })),
  })});
}
function setup(n:number,cap:1|2|3=3){
 let saved:CustomNineAttemptState|null={challengeId:ID,browserKeyDigest:issued.browserKeyDigest,
  attemptId:'123e4567-e89b-42d3-a456-426614174010',revision:0,
  currentProgressionToken:INITIAL,terminalAtBats:[],status:'active',
  createdAt:'2026-10-14T20:00:00Z',updatedAt:'2026-10-14T20:00:00Z',completedAt:null};
 const repository={
  getByKey:vi.fn(async()=>saved?{...saved}:null),
  advanceHint:vi.fn(async(expected:CustomNineAttemptState,next:string)=>{
   if(!saved||saved.revision!==expected.revision||saved.currentProgressionToken!==expected.currentProgressionToken)
    return {status:'conflict' as const};
   saved={...saved,revision:saved.revision+1,currentProgressionToken:next};
   return {status:'advanced' as const,state:{...saved}};
  }),
  advanceTerminal:vi.fn(async(expected:CustomNineAttemptState,next:string,
    fact:import('@initial-baseball/shared').DailyCompletedAtBat)=>{
   if(!saved||saved.revision!==expected.revision||saved.currentProgressionToken!==expected.currentProgressionToken
     || saved.status!=='active')return {status:'conflict' as const};
   const terminalAtBats=[...saved.terminalAtBats,fact];
   const completed=terminalAtBats.length===n;
   saved={...saved,revision:saved.revision+1,currentProgressionToken:next,
     terminalAtBats,status:completed?'completed':'active',
     completedAt:completed?'2026-10-14T21:00:00Z':null};
   return {status:'advanced' as const,state:{...saved}};
  }),
 };
 const dependencies={readChallenge:vi.fn(async()=>challenge(n,cap)),repository:vi.fn(()=>repository),
  resolvePlayer:vi.fn((id:string):Player|null=>IDS.includes(id)?{
   id,fullName:'SECRET_ANSWER',displayName:'SECRET_ANSWER',primaryRole:'hitter',
   primaryPosition:'RF'} as Player:null),
  getReveal:vi.fn((id:string)=>({playerId:id,displayName:'SECRET_ANSWER',playerType:'hitter',
    career:{primaryPosition:'RF',firstSeason:2001,lastSeason:2002,teamIds:[],
      batting:null,pitching:null,advanced:null},seasons:[]} as unknown as CanonicalPlayerReveal)),
  getSecret:vi.fn(()=>SECRET)};
 const service=createServerCustomLineupV2IncorrectGuessService({dependencies});
 return {service,repository,dependencies,read:()=>saved,replace:(v:CustomNineAttemptState|null)=>{saved=v;}};
}
const guess=(progressionToken:string,submittedPlayerId=IDS[1])=>({progressionToken,submittedPlayerId});
describe('private Custom Lineup v2 nonterminal incorrect CAS',()=>{
 it.each([1,5,9,10])('advances exactly two wrong guesses for N=%i, with no answer or future clue',async n=>{
  const s=setup(n);
  let token=INITIAL;
  for(let strike=1;strike<=2;strike++){
   const result=await s.service.attempt(ID,COOKIE,guess(token));
   expect(result.kind).toBe('incorrect');
   if(result.kind!=='incorrect')throw Error('missing incorrect result');
   expect(result.strikeCount).toBe(strike);
   expect(result.revision).toBe(strike);
   expect(TOKENS.verify(result.progressionToken).strikeCount).toBe(strike);
   expect(JSON.stringify(result)).not.toContain('SECRET_ANSWER');
   expect(JSON.stringify(result)).not.toContain('PRIVATE_FUTURE_HINT');
   expect(JSON.stringify(result)).not.toContain('PRIVATE_HINT');
   token=result.progressionToken;
  }
  const third=await s.service.attempt(ID,COOKIE,guess(token));
  expect(third).toMatchObject({kind:'terminal',result:{kind:'strikeout',outcome:'K'},completed:n===1});
  expect(s.repository.advanceHint).toHaveBeenCalledTimes(2);
  expect(s.repository.advanceTerminal).toHaveBeenCalledTimes(1);
  expect(s.read()?.terminalAtBats).toMatchObject([{resolution:'strikeout',wrongGuesses:3}]);
 });
 it.each([1,2,3] as const)('commits K on exactly the %i-th wrong guess with one terminal CAS',async cap=>{
  const s=setup(10,cap);
  let token=INITIAL;
  for(let count=1;count<cap;count++){
   const result=await s.service.attempt(ID,COOKIE,guess(token));
   expect(result).toMatchObject({kind:'incorrect',strikeCount:count,revision:count});
   if(result.kind!=='incorrect')throw Error('missing intermediate strike');
   token=result.progressionToken;
  }
  const final=await s.service.attempt(ID,COOKIE,guess(token));
  expect(final).toMatchObject({kind:'terminal',completed:false,
    result:{kind:'strikeout',strikeCount:cap},revision:cap});
  expect(s.repository.advanceHint).toHaveBeenCalledTimes(cap-1);
  expect(s.repository.advanceTerminal).toHaveBeenCalledOnce();
  expect(s.read()?.terminalAtBats).toEqual([{
   pitchNumber:1,initials:'P1',hintsRevealed:0,wrongGuesses:cap,
   resolution:'strikeout',outcome:'K',
  }]);
  expect(TOKENS.verify(s.read()!.currentProgressionToken)).toMatchObject({
   pitchNumber:2,strikeCount:0,outCount:1,completed:false,
  });
  expect(await s.service.attempt(ID,COOKIE,guess(token))).toEqual({kind:'conflict'});
  // The next at-bat begins at zero; the same immutable cap still applies.
  const next=await s.service.attempt(ID,COOKIE,guess(s.read()!.currentProgressionToken,IDS[9]));
  expect(next.kind).toBe(cap===1?'terminal':'incorrect');
 });
 it.each([1,2,3] as const)('Give Up on cap %i preserves actual guesses and scores K once',async cap=>{
  const s=setup(5,cap);
  let token=INITIAL;
  for(let count=1;count<cap;count++){
   const wrong=await s.service.attempt(ID,COOKIE,guess(token));
   if(wrong.kind!=='incorrect')throw Error('missing wrong guess');
   token=wrong.progressionToken;
  }
  const result=await s.service.attempt(ID,COOKIE,{progressionToken:token,giveUp:true});
  expect(result).toMatchObject({kind:'terminal',result:{kind:'strikeout',strikeCount:cap},
    revision:cap,completed:false});
  expect(s.read()?.terminalAtBats).toMatchObject([{
   resolution:'give_up',outcome:'K',wrongGuesses:cap-1,
  }]);
  expect(s.repository.advanceTerminal).toHaveBeenCalledOnce();
 });
 it.each([1,2] as const)('rejects an illegal cap-%i preterminal signed strike state',async cap=>{
  const s=setup(5,cap);
  const invalid=TOKENS.sign({...CLAIMS,strikeCount:cap});
  expect(await s.service.attempt(ID,COOKIE,guess(invalid))).toEqual({kind:'invalid_progression'});
  expect(s.repository.advanceHint).not.toHaveBeenCalled();
  expect(s.repository.advanceTerminal).not.toHaveBeenCalled();
 });
 it('serializes simultaneous one-strike wrong guesses with one terminal winner',async()=>{
  const s=setup(5,1);
  const attempts=await Promise.all(Array.from({length:6},
   ()=>s.service.attempt(ID,COOKIE,guess(INITIAL))));
  expect(attempts.filter(x=>x.kind==='terminal')).toHaveLength(1);
  expect(attempts.filter(x=>x.kind==='conflict')).toHaveLength(5);
  expect(s.read()?.terminalAtBats).toHaveLength(1);
  expect(s.read()?.revision).toBe(1);
 });
 it('atomically commits correct guesses, withholds future hints and rejects replay',async()=>{
  const s=setup(10);
  const result=await s.service.attempt(ID,COOKIE,guess(INITIAL,IDS[0]));
  expect(result).toMatchObject({kind:'terminal',result:{kind:'correct'},revision:1,completed:false,
    hintBundle:{hints:[],checkpoints:[]}});
  expect(s.repository.advanceHint).not.toHaveBeenCalled();
  expect(s.repository.advanceTerminal).toHaveBeenCalledTimes(1);
  expect(s.read()?.terminalAtBats).toMatchObject([{resolution:'correct',wrongGuesses:0}]);
  expect(await s.service.attempt(ID,COOKIE,guess(INITIAL,IDS[0]))).toEqual({kind:'conflict'});
  expect(JSON.stringify(result)).not.toContain('PRIVATE_FUTURE_HINT');
 });
 it('enforces single-winner CAS and rejects stale tokens',async()=>{
  const s=setup(5);
  const pair=await Promise.all([s.service.attempt(ID,COOKIE,guess(INITIAL)),
    s.service.attempt(ID,COOKIE,guess(INITIAL))]);
  expect(pair.map(x=>x.kind).sort()).toEqual(['conflict','incorrect']);
  expect(await s.service.attempt(ID,COOKIE,guess(INITIAL))).toEqual({kind:'conflict'});
  expect(s.read()?.revision).toBe(1);
 });
 it('serializes mixed correct/incorrect fanout without identifying an uncommitted answer',async()=>{
  const s=setup(10);
  const attempts=await Promise.all([
    ...Array.from({length:8},(_,i)=>s.service.attempt(ID,COOKIE,guess(INITIAL,IDS[i+1]))),
    s.service.attempt(ID,COOKIE,guess(INITIAL,IDS[0])),
  ]);
  expect(attempts.filter(x=>x.kind!=='conflict')).toHaveLength(1);
  const winner=attempts.find(x=>x.kind!=='conflict');
  expect(['terminal','incorrect']).toContain(winner?.kind);
  expect(s.read()?.revision).toBe(1);
 });
 it('persists give-up terminal with existing wrong guesses, exactly once',async()=>{
  const s=setup(5);
  const wrong=await s.service.attempt(ID,COOKIE,guess(INITIAL));
  expect(wrong.kind).toBe('incorrect');
  if(wrong.kind!=='incorrect')throw Error('missing strike');
  const result=await s.service.attempt(ID,COOKIE,{progressionToken:wrong.progressionToken,giveUp:true});
  expect(result).toMatchObject({kind:'terminal',result:{kind:'strikeout'},revision:2});
  expect(s.read()?.terminalAtBats).toMatchObject([{resolution:'give_up',wrongGuesses:1}]);
  expect(await s.service.attempt(ID,COOKIE,{progressionToken:wrong.progressionToken,giveUp:true}))
    .toEqual({kind:'conflict'});
 });
 it('completes N=1 challenge at the first terminal and rejects further mutation',async()=>{
  const s=setup(1);
  expect(await s.service.attempt(ID,COOKIE,guess(INITIAL,IDS[0])))
    .toMatchObject({kind:'terminal',completed:true,hintBundle:null});
  expect(s.read()?.status).toBe('completed');
  expect(await s.service.attempt(ID,COOKIE,guess(INITIAL,IDS[0]))).toEqual({kind:'completed'});
 });
 it('rejects creator, missing, malformed, cross-domain tokens and extra input',async()=>{
  const s=setup(9);
  const creator=createCustomLineupV2CreatorBrowserMarker(SECRET).creatorCookie(ID,'https://test.example').split(';')[0]!;
  for(const c of [null,creator,COOKIE+'; '+creator,COOKIE+'; '+COOKIE])
   expect(await s.service.attempt(ID,c,guess(INITIAL))).toEqual({kind:'invalid_credential'});
  for(const request of [null,{},guess(''),guess(INITIAL,'not-canonical'),
    {...guess(INITIAL),giveUp:false},guess(createCustomNineProgressionTokens(SECRET).sign(CLAIMS))])
   expect(await s.service.attempt(ID,COOKIE,request)).toEqual({kind:'invalid_progression'});
  expect(s.repository.advanceHint).not.toHaveBeenCalled();
 });
 it('rejects invalid durable revision, missing attempt and terminal saved state',async()=>{
  const s=setup(5),prior=s.read()!;
  s.replace({...prior,revision:1});
  expect(await s.service.attempt(ID,COOKIE,guess(INITIAL))).toEqual({kind:'invalid_progression'});
  s.replace(null);
  expect(await s.service.attempt(ID,COOKIE,guess(INITIAL))).toEqual({kind:'invalid_credential'});
  s.replace({...prior,status:'completed',completedAt:'2026-10-14T21:00:00Z'});
  expect(await s.service.attempt(ID,COOKIE,guess(INITIAL))).toEqual({kind:'completed'});
  expect(s.repository.advanceHint).not.toHaveBeenCalled();
 });
 it('never returns uncommitted progression on CAS conflict',async()=>{
  const s=setup(10);
  s.repository.advanceHint.mockResolvedValueOnce({status:'conflict'} as never);
  expect(await s.service.attempt(ID,COOKIE,guess(INITIAL))).toEqual({kind:'conflict'});
 });
 it('never exposes an uncommitted answer on terminal CAS conflict',async()=>{
  const s=setup(9);
  s.repository.advanceTerminal.mockResolvedValueOnce({status:'conflict'} as never);
  expect(await s.service.attempt(ID,COOKIE,guess(INITIAL,IDS[0]))).toEqual({kind:'conflict'});
 });
});
