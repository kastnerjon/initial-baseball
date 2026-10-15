import { describe, expect, it, vi } from 'vitest';
import { createCustomLineupIssuedChallenge, createCustomLineupIssuedClueSnapshot } from '@initial-baseball/daily';
import { createCustomLineupV2ProgressionTokens } from './serverCustomLineupV2Bootstrap';
import { CUSTOM_NINE_SESSION_DATE, createCustomNineProgressionTokens } from './serverCustomNineBootstrap';
import { createCustomLineupV2AttemptBrowserCredential, createCustomNineAttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { createCustomLineupV2CreatorBrowserMarker, createCustomNineCreatorBrowserMarker } from './customNineCreatorBrowser';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';
vi.mock('server-only', () => ({}));
import { createServerCustomLineupV2AttemptBootstrap } from './serverCustomLineupV2AttemptBootstrap';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174001';
const V1 = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const SECRET = 'long-private-credential-and-progression-secret-for-v2-tests';
const URL = 'https://example.test/api/custom-lineup/challenges/' + ID + '/attempt/bootstrap';
const IDS = Array.from({length:10},(_,i)=>'ibp_'+(i+1).toString(16).padStart(20,'0'));
const HINTS = [
  {slot:1 as const,hintType:'main_decade' as const,displayLabel:'Decade'},
  {slot:2 as const,hintType:'teams' as const,displayLabel:'Teams'},
  {slot:3 as const,hintType:'position' as const,displayLabel:'Position'},
  {slot:4 as const,hintType:'stats' as const,displayLabel:'Stats'},
];
function challenge(n:number){
 return createCustomLineupIssuedChallenge({
  puzzleId:ID, issuedAt:'2026-10-14T12:00:00Z',
  canonicalPlayerIds:IDS.slice(0,n),
  clueSnapshot:createCustomLineupIssuedClueSnapshot({
   hintLayout:HINTS,
   pitches:IDS.slice(0,n).map((canonicalPlayerId,i)=>({
    pitchNumber:i+1,canonicalPlayerId,initials:'P'+(i+1),
    hintValues:['DECADE_'+(i+1),'TEAMS_'+(i+1),'POSITION_'+(i+1),'STATS_'+(i+1)],
   })),
  }),
 });
}
const tokens = createCustomLineupV2ProgressionTokens(SECRET);
const OPEN = tokens.sign({ version:1, rulesetVersion:'points-v4', puzzleId:ID,
  puzzleDate:CUSTOM_NINE_SESSION_DATE, pitchNumber:1, revealCount:0,
  strikeCount:0, outCount:0, completed:false });
function opening(n: number) {
  return {
    puzzleId:ID, rulesetVersion:'points-v4' as const,
    atBats:Array.from({length:n},(_,i)=>({pitchNumber:i+1,initials:'P'+(i+1)})),
    progressionToken:OPEN,
    hintBundle:{
      pitchNumber:1,revealedCount:0 as const,
      hints:[{slot:1 as const,hintType:'main_decade' as const,hintLabel:'Decade',hintValue:'SECRET_FIRST_HINT'}],
      checkpoints:[{revealedCount:1 as const,progressionToken:tokens.sign({
        ...tokens.verify(OPEN),revealCount:1,
      })}],
    },
  };
}
function saved(digest:string, token=OPEN, status:'active'|'completed'='active',
  revision=0):CustomNineAttemptState {
  return {challengeId:ID,browserKeyDigest:digest,
    attemptId:'123e4567-e89b-42d3-a456-426614174010',
    revision,currentProgressionToken:token,terminalAtBats:[],
    status,createdAt:'2026-10-14T12:00:00Z',updatedAt:'2026-10-14T12:00:00Z',
    completedAt:status==='completed'?'2026-10-14T13:00:00Z':null};
}
function setup(n:number) {
  const map=new Map<string,CustomNineAttemptState>();
  const repo={
    getByKey:vi.fn(async(key:{browserKeyDigest:string})=>map.get(key.browserKeyDigest)??null),
    getOrCreate:vi.fn(async(key:{browserKeyDigest:string},token:string)=>{
      const old=map.get(key.browserKeyDigest),state=old??saved(key.browserKeyDigest,token);
      if(!old)map.set(key.browserKeyDigest,state);
      return {status:(old?'existing':'inserted') as 'existing'|'inserted',state};
    }),
  };
  const deps={
    opening:vi.fn(async()=>opening(n)),
    repository:vi.fn((_env:Record<string,string|undefined>,_count:number)=>repo),
    readChallenge:vi.fn(async()=>challenge(n)),
    getSecret:vi.fn(()=>SECRET),
  };
  return {map,repo,deps,service:createServerCustomLineupV2AttemptBootstrap({dependencies:deps})};
}
describe('private Custom v2 first-attempt reservation',()=>{
  it.each([1,5,9,10])('reserves exactly one N=%i challenge attempt and redacts clues',async n=>{
    const {service,repo,deps}=setup(n);
    const first=await service.bootstrap(ID,null,URL);
    expect(first.kind).toBe('ready');
    if(first.kind!=='ready')throw Error('ready');
    expect(first.bootstrap.atBats).toHaveLength(n);
    expect(first.bootstrap.hintBundle.hints).toEqual([]);
    expect(first.bootstrap.hintBundle.checkpoints).toEqual([]);
    expect(first.bootstrap.progressionToken).toBe(OPEN);
    expect(first.setCookie).toContain('Path=/api/custom-lineup/challenges/'+ID);
    expect(first.setCookie).toContain('HttpOnly; SameSite=Strict; Secure');
    expect(first.setCookie).not.toContain('Domain=');
    expect(first.setCookie).not.toContain('123e4567-e89b-42d3-a456-426614174010');
    expect(deps.repository).toHaveBeenCalledWith(expect.anything(),n);
    expect(repo.getOrCreate).toHaveBeenCalledOnce();
    const cookie=first.setCookie!.split(';')[0]!;
    const second=await service.bootstrap(ID,cookie,URL);
    expect(second.kind).toBe('ready');
    if(second.kind!=='ready')throw Error('ready');
    expect(second.setCookie).toBeNull();
    expect(repo.getOrCreate).toHaveBeenCalledOnce();
    expect(repo.getByKey).toHaveBeenCalledOnce();
    expect(deps.readChallenge).not.toHaveBeenCalled();
    expect(JSON.stringify(second)).not.toContain('SECRET_FIRST_HINT');
  });
  it('keeps v2 credentials and creator provenance isolated from v1 and other challenges',async()=>{
    const v2=createCustomLineupV2AttemptBrowserCredential(SECRET);
    const first=v2.issue(ID,URL);
    const pair=first.setCookie.split(';')[0]!;
    expect(v2.inspect(pair,ID)).toEqual({kind:'valid',browserKeyDigest:first.browserKeyDigest});
    expect(v2.inspect(pair,OTHER)).toEqual({kind:'absent'});
    expect(v2.inspect(pair+'; '+pair,ID)).toEqual({kind:'invalid'});
    expect(v2.inspect(pair.replace(/.$/,'!'),ID)).toEqual({kind:'invalid'});
    expect(v2.inspect(pair,ID)).not.toEqual(v2.inspect('',ID));
    expect(createCustomNineAttemptBrowserCredential(SECRET).inspect('',V1)).toEqual({kind:'absent'});
    expect(createCustomNineCreatorBrowserMarker(SECRET).inspect(null,V1)).toBe('unmarked');
    expect(createCustomLineupV2CreatorBrowserMarker(SECRET).inspect(null,ID)).toBe('unmarked');
    // A 43-character HMAC uses only the two high-order bits of its last base64url
    // character; alternate low bits must not validate the same signature bytes.
    const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const canonical=createCustomLineupV2CreatorBrowserMarker(SECRET).creatorCookie(ID,URL).split(';')[0]!;
    const last=canonical.slice(-1),index=alphabet.indexOf(last);
    const noncanonical=canonical.slice(0,-1)+alphabet[(index&~3)|((index+1)&3)];
    expect(createCustomLineupV2CreatorBrowserMarker(SECRET).inspect(noncanonical,ID)).toBe('invalid');
    const v1Cookie=createCustomNineCreatorBrowserMarker(SECRET).creatorCookie(V1,URL).split(';')[0]!;
    const v1Last=v1Cookie.slice(-1),v1Index=alphabet.indexOf(v1Last);
    const v1Changed=v1Cookie.slice(0,-1)+alphabet[(v1Index&~3)|((v1Index+1)&3)];
    expect(createCustomNineCreatorBrowserMarker(SECRET).inspect(v1Changed,V1)).toBe('invalid');
    expect(()=>v2.issue(V1,URL)).toThrow();
  });
  it('never reserves creator-marked challenge, and blocks forged/duplicate cookies',async()=>{
    const {service,repo,deps}=setup(5);
    const creators=createCustomLineupV2CreatorBrowserMarker(SECRET);
    const creator=creators.creatorCookie(ID,URL).split(';')[0]!;
    const result=await service.bootstrap(ID,creator,URL);
    expect(result.kind).toBe('preview');
    if(result.kind!=='preview')throw Error('preview');
    expect(result.bootstrap.hintBundle.hints).toEqual([]);
    expect(repo.getOrCreate).not.toHaveBeenCalled();
    expect(deps.repository).not.toHaveBeenCalled();
    expect(deps.readChallenge).not.toHaveBeenCalled();
    const forged=creator.split('=')[0]+'=garbage';
    expect(await service.bootstrap(ID,forged,URL)).toEqual({kind:'invalid_credential'});
    const cookie=createCustomLineupV2AttemptBrowserCredential(SECRET).issue(ID,URL).setCookie.split(';')[0]!;
    expect(await service.bootstrap(ID,cookie+'; '+cookie,URL)).toEqual({kind:'invalid_credential'});
    expect(await service.bootstrap(ID,forged+'; '+cookie,URL)).toEqual({kind:'invalid_credential'});
    expect(repo.getOrCreate).not.toHaveBeenCalled();
  });
  it('fails closed on missing, replaced, foreign or progressed ledger state',async()=>{
    const {service,repo,map}=setup(10);
    const initial=await service.bootstrap(ID,null,URL);
    if(initial.kind!=='ready')throw Error('ready');
    const cookie=initial.setCookie!.split(';')[0]!;
    const digest=[...map.keys()][0]!;
    map.delete(digest);
    expect(await service.bootstrap(ID,cookie,URL)).toEqual({kind:'invalid_credential'});
    expect(repo.getOrCreate).toHaveBeenCalledOnce();
    map.set(digest,saved(digest,OPEN,'active',1));
    await expect(service.bootstrap(ID,cookie,URL)).rejects.toThrow('history mismatch');
    const advanced=tokens.sign({...tokens.verify(OPEN),pitchNumber:10});
    map.set(digest,saved(digest,advanced,'active',3));
    await expect(service.bootstrap(ID,cookie,URL)).rejects.toThrow('history mismatch');
    map.set(digest,saved(digest,createCustomNineProgressionTokens(SECRET).sign({
      ...tokens.verify(OPEN),puzzleId:V1,
    })));
    await expect(service.bootstrap(ID,cookie,URL)).rejects.toThrow();
    expect(repo.getOrCreate).toHaveBeenCalledOnce();
  });
  it.each([1,5,9,10])('resumes signed N=%i strikes and earned clues without resetting',async n=>{
    const s=setup(n);
    const first=await s.service.bootstrap(ID,null,URL);
    if(first.kind!=='ready')throw Error('first attempt missing');
    const cookie=first.setCookie!.split(';')[0]!;
    const digest=[...s.map.keys()][0]!;
    const progressed=tokens.sign({...tokens.verify(OPEN),revealCount:2,strikeCount:1});
    s.map.set(digest,saved(digest,progressed,'active',3));
    const restored=await s.service.bootstrap(ID,cookie,URL);
    expect(restored).toMatchObject({
      kind:'ready',setCookie:null,attemptProgress:{strikeCount:1,completedAtBats:[]},
      bootstrap:{progressionToken:progressed,
        hintBundle:{pitchNumber:1,revealedCount:2,checkpoints:[],
          hints:[
            {slot:1,hintLabel:'Decade',hintValue:'DECADE_1'},
            {slot:2,hintLabel:'Teams',hintValue:'TEAMS_1'},
          ]}},
    });
    expect(JSON.stringify(restored)).not.toContain('POSITION_1');
    expect(JSON.stringify(restored)).not.toContain('STATS_1');
    expect(JSON.stringify(restored)).not.toContain('DECADE_2');
    expect(JSON.stringify(restored)).not.toContain('ibp_');
    expect(s.repo.getOrCreate).toHaveBeenCalledOnce();
    expect(s.deps.readChallenge).toHaveBeenCalledOnce();
    expect(s.map.get(digest)?.revision).toBe(3);
    const repeated=await s.service.bootstrap(ID,cookie,URL);
    expect(repeated).toEqual(restored);
  });
  it.each([5,9,10])('resumes N=%i after completed batters, with precise active batter',async n=>{
    const s=setup(n);
    const first=await s.service.bootstrap(ID,null,URL);
    if(first.kind!=='ready')throw Error('first attempt missing');
    const cookie=first.setCookie!.split(';')[0]!;
    const digest=[...s.map.keys()][0]!;
    const terminalAtBats=[
      {pitchNumber:1,initials:'P1',outcome:'HR' as const,hintsRevealed:0 as const,
       wrongGuesses:0,resolution:'correct' as const},
      {pitchNumber:2,initials:'P2',outcome:'K' as const,hintsRevealed:0 as const,
       wrongGuesses:1,resolution:'give_up' as const},
    ];
    const token=tokens.sign({...tokens.verify(OPEN),pitchNumber:3,
      revealCount:1,strikeCount:2,outCount:1});
    s.map.set(digest,{...saved(digest,token,'active',6),terminalAtBats});
    const restored=await s.service.bootstrap(ID,cookie,URL);
    expect(restored).toMatchObject({kind:'ready',setCookie:null,
      attemptProgress:{strikeCount:2,completedAtBats:terminalAtBats},
      bootstrap:{progressionToken:token,
        hintBundle:{pitchNumber:3,revealedCount:1,checkpoints:[],
          hints:[{slot:1,hintValue:'DECADE_3'}]}}});
    expect(JSON.stringify(restored)).not.toContain('TEAMS_3');
    expect(JSON.stringify(restored)).not.toContain('DECADE_4');
    expect(s.map.get(digest)?.revision).toBe(6);
  });
  it.each([1,5,9,10])('reads completed N=%i attempts without issuing live tokens or future clues',async n=>{
    const s=setup(n);
    const first=await s.service.bootstrap(ID,null,URL);
    if(first.kind!=='ready')throw Error('first attempt missing');
    const cookie=first.setCookie!.split(';')[0]!;
    const digest=[...s.map.keys()][0]!;
    const terminalAtBats=Array.from({length:n},(_,i)=>({
      pitchNumber:i+1,initials:'P'+(i+1),outcome:'HR' as const,
      hintsRevealed:0 as const,wrongGuesses:0,resolution:'correct' as const,
    }));
    const finished=tokens.sign({...tokens.verify(OPEN),pitchNumber:n,completed:true});
    s.map.set(digest,{...saved(digest,finished,'completed',n),terminalAtBats});
    const restored=await s.service.bootstrap(ID,cookie,URL);
    expect(restored).toMatchObject({kind:'completed',revision:n,
      completedAt:expect.any(String),completedAtBats:terminalAtBats});
    if(restored.kind!=='completed')throw Error('completed not restored');
    expect(restored.atBats).toHaveLength(n);
    expect(JSON.stringify(restored)).not.toContain('progressionToken');
    expect(JSON.stringify(restored)).not.toContain('hintBundle');
    expect(JSON.stringify(restored)).not.toContain('ibp_');
    expect(s.repo.getOrCreate).toHaveBeenCalledOnce();
  });
  it('fails closed for tampered past facts, forged counts and issued snapshot drift',async()=>{
    const s=setup(5);
    const initial=await s.service.bootstrap(ID,null,URL);
    if(initial.kind!=='ready')throw Error('first attempt missing');
    const cookie=initial.setCookie!.split(';')[0]!;
    const digest=[...s.map.keys()][0]!;
    const claims=tokens.verify(OPEN);
    const token=tokens.sign({...claims,pitchNumber:2});
    const fact={pitchNumber:1,initials:'P1',outcome:'HR' as const,
      hintsRevealed:0 as const,wrongGuesses:0,resolution:'correct' as const};
    const valid={...saved(digest,token,'active',1),terminalAtBats:[fact]};
    for(const invalid of [
      {...valid,revision:2},
      {...valid,terminalAtBats:[{...fact,initials:'P2'}]},
      {...valid,currentProgressionToken:tokens.sign({...claims,pitchNumber:2,outCount:1})},
    ]){
      s.map.set(digest,invalid);
      await expect(s.service.bootstrap(ID,cookie,URL)).rejects.toThrow('history mismatch');
    }
    s.map.set(digest,valid);
    s.deps.readChallenge.mockResolvedValueOnce(challenge(1) as never);
    await expect(s.service.bootstrap(ID,cookie,URL)).rejects.toThrow('history mismatch');
    s.deps.readChallenge.mockResolvedValueOnce(null as never);
    await expect(s.service.bootstrap(ID,cookie,URL)).rejects.toThrow('challenge unavailable');
    expect(s.repo.getOrCreate).toHaveBeenCalledOnce();
  });
  it('rejects invalid challenge and mismatched opening before any reservation',async()=>{
    const {service,deps,repo}=setup(5);
    expect(await service.bootstrap(V1,null,URL)).toEqual({kind:'not_found'});
    expect(deps.opening).not.toHaveBeenCalled();
    deps.opening.mockResolvedValueOnce({...opening(5),atBats:opening(5).atBats.slice(1)});
    await expect(service.bootstrap(ID,null,URL)).rejects.toThrow('Invalid Custom v2 issued opening');
    deps.opening.mockResolvedValueOnce({...opening(5),progressionToken:tokens.sign({
      ...tokens.verify(OPEN),pitchNumber:2,
    })});
    await expect(service.bootstrap(ID,null,URL)).rejects.toThrow('Invalid Custom v2 initial progression');
    expect(repo.getOrCreate).not.toHaveBeenCalled();
  });
});
