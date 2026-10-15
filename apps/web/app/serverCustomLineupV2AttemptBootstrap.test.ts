import { describe, expect, it, vi } from 'vitest';
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
    expect(await service.bootstrap(ID,cookie,URL)).toEqual({kind:'continuation_pending'});
    const advanced=tokens.sign({...tokens.verify(OPEN),pitchNumber:10});
    map.set(digest,saved(digest,advanced,'active',3));
    expect(await service.bootstrap(ID,cookie,URL)).toEqual({kind:'continuation_pending'});
    map.set(digest,saved(digest,createCustomNineProgressionTokens(SECRET).sign({
      ...tokens.verify(OPEN),puzzleId:V1,
    })));
    await expect(service.bootstrap(ID,cookie,URL)).rejects.toThrow();
    expect(repo.getOrCreate).toHaveBeenCalledOnce();
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
