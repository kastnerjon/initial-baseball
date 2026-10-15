import { describe, expect, it, vi } from 'vitest';
import { createCustomLineupIssuedChallenge, createCustomLineupIssuedClueSnapshot } from '@initial-baseball/daily';
import type { Player } from '@initial-baseball/shared';
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
function challenge(n:number) {
 return createCustomLineupIssuedChallenge({puzzleId:ID,issuedAt:'2026-10-14T12:00:00Z',
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
function setup(n:number){
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
 };
 const dependencies={readChallenge:vi.fn(async()=>challenge(n)),repository:vi.fn(()=>repository),
  resolvePlayer:vi.fn((id:string):Player|null=>IDS.includes(id)?{
   id,fullName:'SECRET_ANSWER',displayName:'SECRET_ANSWER',primaryRole:'hitter',
   primaryPosition:'RF'} as Player:null),getSecret:vi.fn(()=>SECRET)};
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
  expect(await s.service.attempt(ID,COOKIE,guess(token))).toEqual({kind:'terminal_pending'});
  expect(s.repository.advanceHint).toHaveBeenCalledTimes(2);
  expect(s.read()?.terminalAtBats).toEqual([]);
 });
 it('blocks correct guesses without saving a revision or leaking an answer',async()=>{
  const s=setup(10);
  expect(await s.service.attempt(ID,COOKIE,guess(INITIAL,IDS[0]))).toEqual({kind:'terminal_pending'});
  expect(s.repository.advanceHint).not.toHaveBeenCalled();
 });
 it('enforces single-winner CAS and rejects stale tokens',async()=>{
  const s=setup(5);
  const pair=await Promise.all([s.service.attempt(ID,COOKIE,guess(INITIAL)),
    s.service.attempt(ID,COOKIE,guess(INITIAL))]);
  expect(pair.map(x=>x.kind).sort()).toEqual(['conflict','incorrect']);
  expect(await s.service.attempt(ID,COOKIE,guess(INITIAL))).toEqual({kind:'conflict'});
  expect(s.read()?.revision).toBe(1);
 });
 it('rejects creator, missing, malformed, cross-domain tokens and extra input',async()=>{
  const s=setup(9);
  const creator=createCustomLineupV2CreatorBrowserMarker(SECRET).creatorCookie(ID,'https://test.example').split(';')[0]!;
  for(const c of [null,creator,COOKIE+'; '+creator,COOKIE+'; '+COOKIE])
   expect(await s.service.attempt(ID,c,guess(INITIAL))).toEqual({kind:'invalid_credential'});
  for(const request of [null,{},guess(''),guess(INITIAL,'not-canonical'),
    {...guess(INITIAL),giveUp:true},guess(createCustomNineProgressionTokens(SECRET).sign(CLAIMS))])
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
});
