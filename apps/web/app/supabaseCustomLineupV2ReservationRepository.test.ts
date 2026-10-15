import { describe,expect,it,vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
vi.mock('server-only',()=>({}));
import {createSupabaseCustomLineupV2ReservationRepository}
  from './supabaseCustomLineupV2ReservationRepository';
import {decodeCustomLineupV2AttemptRow} from './customNineAttemptRowCodec';

const ID='custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const DIGEST='a'.repeat(64),TOKEN='signed.initial.token';
const DATE='2026-10-14T12:00:00Z';
const KEY={challengeId:ID,browserKeyDigest:DIGEST};
const row=()=>({challenge_id:ID,browser_key_digest:DIGEST,
 attempt_id:'123e4567-e89b-42d3-a456-426614174010',
 revision:0,current_progression_token:TOKEN,terminal_at_bats:[],
 status:'active',completed_at:null,created_at:DATE,updated_at:DATE});
function fakeDb(){
 const map=new Map<string,Record<string,unknown>>();
 const from=vi.fn((_table:string)=>({
  insert:(payload:Record<string,unknown>)=>({select:()=>({single:async()=>{
    const key=String(payload.challenge_id)+':'+String(payload.browser_key_digest);
    if(map.has(key))return {data:null,error:{code:'23505'}};
    const value={...payload,created_at:DATE,updated_at:DATE};
    map.set(key,value);return {data:value,error:null};
  }})}),
  select:()=>{const values:Record<string,unknown>={};const builder={
    eq:(k:string,v:unknown)=>{values[k]=v;return builder;},
    maybeSingle:async()=>({data:[...map.values()].find(r=>Object.entries(values).every(([k,v])=>r[k]===v))??null,error:null}),
  };return builder;},
 }));
 return {client:{from} as unknown as SupabaseClient,from,map};
}
describe('Custom v2 private attempt reservation and exact N row decoder',()=>{
 it.each([1,5,9,10])('reserves first immutable N=%i attempt with concurrent loser observing winner',async n=>{
   const db=fakeDb(),repo=createSupabaseCustomLineupV2ReservationRepository(db.client,n);
   const a=await repo.getOrCreate(KEY,TOKEN),b=await repo.getOrCreate(KEY,'other.initial.token');
   expect(a.status).toBe('inserted');expect(b.status).toBe('existing');
   expect(a.state.attemptId).toBe(b.state.attemptId);
   expect(b.state.currentProgressionToken).toBe(TOKEN);
   expect((await repo.getByKey(KEY))?.status).toBe('active');
   expect(db.map.size).toBe(1);
   expect(db.from).toHaveBeenCalledWith('custom_nine_attempt_states');
 });
 it('rejects malformed, v1, wrong length and early completion records',()=>{
   const current=row();
   expect(decodeCustomLineupV2AttemptRow(current,10).revision).toBe(0);
   for(const change of [
     {challenge_id:'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000'},
     {revision:-1},{browser_key_digest:'b'.repeat(63)},
     {terminal_at_bats:[{pitchNumber:2,initials:'P2',outcome:'HR',hintsRevealed:0,wrongGuesses:0,resolution:'correct'}]},
     {status:'completed',completed_at:DATE},
     {status:'active',completed_at:DATE},
     {current_progression_token:''},
   ])expect(()=>decodeCustomLineupV2AttemptRow({...current,...change},10)).toThrow();
   expect(()=>decodeCustomLineupV2AttemptRow(current,11)).toThrow();
   expect(()=>decodeCustomLineupV2AttemptRow(current,0)).toThrow();
 });
 it('returns missing, rejects provider failures and malformed IDs before DB access',async()=>{
   const db=fakeDb(),repo=createSupabaseCustomLineupV2ReservationRepository(db.client,5);
   await expect(repo.getByKey(KEY)).resolves.toBeNull();
   await expect(repo.getOrCreate({challengeId:'bad',browserKeyDigest:DIGEST},TOKEN))
     .rejects.toMatchObject({kind:'invalid-row'});
   expect(db.map.size).toBe(0);
   const failing={from:()=>{throw Error('PRIVATE_KEY')}} as unknown as SupabaseClient;
   await expect(createSupabaseCustomLineupV2ReservationRepository(failing,5).getByKey(KEY))
     .rejects.toMatchObject({kind:'query',message:expect.not.stringContaining('PRIVATE_KEY')});
 });
});


describe('v2 hint-only revision CAS', () => {
 it.each([1,5,9,10])('serializes one hint winner for N=%i without changing terminal facts',async n=>{
  const data=row(),key=KEY;
  let current={...data};
  const update=vi.fn((payload:Record<string,unknown>)=>{
    const predicates:Record<string,unknown>={};
    const builder={
      eq:(k:string,v:unknown)=>{predicates[k]=v;return builder;},
      select:()=>({maybeSingle:async()=>{
        if(!Object.entries(predicates).every(([k,v])=>(current as Record<string,unknown>)[k]===v))
          return {data:null,error:null};
        current={...current,...payload};
        return {data:{...current},error:null};
      }}),
    };return builder;
  });
  const client={from:()=>({update})} as unknown as SupabaseClient;
  const repo=createSupabaseCustomLineupV2ReservationRepository(client,n);
  const expected=decodeCustomLineupV2AttemptRow(data,n);
  const results=await Promise.all([
    repo.advanceHint(expected,'next.signed.token'),repo.advanceHint(expected,'other.signed.token'),
  ]);
  expect(results.map(result=>result.status).sort()).toEqual(['advanced','conflict']);
  expect(current.revision).toBe(1);
  expect(current.status).toBe('active');
  expect(current.terminal_at_bats).toEqual([]);
  expect(current.completed_at).toBeNull();
  expect(update).toHaveBeenCalledTimes(2);
 });
 it('rejects invalid expected state and identical successor before provider writes',async()=>{
  const update=vi.fn();
  const repo=createSupabaseCustomLineupV2ReservationRepository(
    {from:()=>({update})} as unknown as SupabaseClient,5);
  const expected=decodeCustomLineupV2AttemptRow(row(),5);
  await expect(repo.advanceHint(expected,TOKEN)).rejects.toMatchObject({kind:'invalid-row'});
  await expect(repo.advanceHint({...expected,revision:-1},'next')).rejects.toMatchObject({kind:'invalid-row'});
  expect(update).not.toHaveBeenCalled();
 });
});

describe('v2 exact-N terminal CAS',()=>{
 it.each([1,5,9,10])('appends exactly one terminal fact for N=%i; completes only at N',async n=>{
  const data=row();
  let current={...data} as Record<string,unknown>;
  const update=vi.fn((payload:Record<string,unknown>)=>{
   const predicates:Record<string,unknown>={};
   const builder={eq:(k:string,v:unknown)=>{predicates[k]=v;return builder;},
    select:()=>({maybeSingle:async()=>{
     if(!Object.entries(predicates).every(([k,v])=>current[k]===v))
       return {data:null,error:null};
     current={...current,...payload};return {data:{...current},error:null};
    }})};return builder;
  });
  const repo=createSupabaseCustomLineupV2ReservationRepository(
    {from:()=>({update})} as unknown as SupabaseClient,n);
  const expected=decodeCustomLineupV2AttemptRow(data,n);
  const fact={pitchNumber:1,initials:'P1',outcome:'HR' as const,
    hintsRevealed:0,wrongGuesses:0,resolution:'correct' as const};
  const pair=await Promise.all([
    repo.advanceTerminal(expected,'signed.correct.successor',fact),
    repo.advanceTerminal(expected,'signed.alternate.successor',fact),
  ]);
  expect(pair.map(x=>x.status).sort()).toEqual(['advanced','conflict']);
  expect(current.revision).toBe(1);
  expect((current.terminal_at_bats as unknown[]).length).toBe(1);
  expect(current.status).toBe(n===1?'completed':'active');
  expect(current.completed_at===null).toBe(n!==1);
 });
});
