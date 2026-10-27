import { createCustomLineupIssuedChallenge, createCustomLineupIssuedClueSnapshot } from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe,expect,it,vi } from 'vitest';
vi.mock('server-only',()=>({}));
import {createSupabaseCustomLineupV2IssuedReader,decodeCustomLineupV2IssuedRow}
  from './supabaseCustomLineupV2IssuedReader';

const ID='custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
function fixture(n:number){
  const ids=Array.from({length:n},(_,i)=>'player-'+(i+1));
  const hints=[
    {slot:1,hintType:'main_decade',displayLabel:'Decade'},
    {slot:2,hintType:'teams',displayLabel:'Teams'},
    {slot:3,hintType:'position',displayLabel:'Position'},
    {slot:4,hintType:'stats',displayLabel:'Stats'},
  ] as const;
  const clue_snapshot=createCustomLineupIssuedClueSnapshot({
    hintLayout:hints,pitches:ids.map((canonicalPlayerId,i)=>({
      pitchNumber:i+1,canonicalPlayerId,initials:'P'+(i+1),
      hintValues:['2000s','Mets','SS','HR 123'],
    })),
  });
  return {puzzle_id:ID,schema_version:2,ruleset_version:'points-v4',
    canonical_player_ids:ids,clue_snapshot,issued_at:'2026-10-14T19:00:00Z'};
}
function reader(data:unknown,error:unknown=null) {
  const maybeSingle=vi.fn().mockResolvedValue({data,error});
  const match=vi.fn().mockReturnValue({maybeSingle});
  const select=vi.fn().mockReturnValue({match});
  const from=vi.fn().mockReturnValue({select});
  return {repo:createSupabaseCustomLineupV2IssuedReader({from} as unknown as SupabaseClient),from,match};
}
describe('private v2 issued challenge read boundary',()=>{
  it('reads only narrow account owner metadata and rejects corrupt rows',async()=>{
    const account='123e4567-e89b-42d3-a456-426614174099';
    const maybeSingle=vi.fn().mockResolvedValue({data:{creator_account_id:account},error:null});
    const eq=vi.fn().mockReturnThis();
    const select=vi.fn().mockReturnValue({eq,maybeSingle});
    const from=vi.fn().mockReturnValue({select});
    const adapter=createSupabaseCustomLineupV2IssuedReader({from} as unknown as SupabaseClient);
    await expect(adapter.getCreatorAccountId(ID)).resolves.toBe(account);
    expect(from).toHaveBeenCalledWith('custom_nine_issued_challenges');
    expect(select).toHaveBeenCalledWith('creator_account_id');
    expect(eq).toHaveBeenCalledWith('puzzle_id',ID);
    expect(eq).toHaveBeenCalledWith('schema_version',2);
    maybeSingle.mockResolvedValueOnce({data:{creator_account_id:null},error:null});
    await expect(adapter.getCreatorAccountId(ID)).resolves.toBeNull();
    maybeSingle.mockResolvedValueOnce({data:null,error:null});
    await expect(adapter.getCreatorAccountId(ID)).resolves.toBeNull();
    for (const row of [{},{creator_account_id:'invalid'},{creator_account_id:42}]) {
      maybeSingle.mockResolvedValueOnce({data:row,error:null});
      await expect(adapter.getCreatorAccountId(ID)).rejects.toMatchObject({kind:'invalid-row'});
    }
    maybeSingle.mockResolvedValueOnce({data:null,error:{message:'PRIVATE SQL'}});
    await expect(adapter.getCreatorAccountId(ID)).rejects.toMatchObject({kind:'query'});
    const before=from.mock.calls.length;
    await expect(adapter.getCreatorAccountId('bad-id')).rejects.toThrow();
    expect(from).toHaveBeenCalledTimes(before);
  });
  it.each([1,5,9,10])('reads strict schema-2 frozen %i batter challenge',async n=>{
    const row=fixture(n),decoded=decodeCustomLineupV2IssuedRow(row);
    const expected=createCustomLineupIssuedChallenge({
      puzzleId:ID,canonicalPlayerIds:row.canonical_player_ids,
      clueSnapshot:row.clue_snapshot,issuedAt:row.issued_at,
    });
    expect(decoded).toEqual(expected);
    expect(Object.isFrozen(decoded.clueSnapshot.pitches[0]?.hintValues)).toBe(true);
    const {repo,from,match}=reader(row);
    await expect(repo.getById(ID)).resolves.toEqual(expected);
    expect(from).toHaveBeenCalledWith('custom_nine_issued_challenges');
    expect(match).toHaveBeenCalledWith({puzzle_id:ID,schema_version:2});
  });
  it('rejects v1, 0/11, broken and mismatched challenge records',async()=>{
    const good=fixture(1);
    const invalid=[
      {...good,schema_version:1},
      {...good,canonical_player_ids:[]},
      {...good,clue_snapshot:{...good.clue_snapshot,pitches:[]}},
      {...good,clue_snapshot:{...good.clue_snapshot,pitches:[{...good.clue_snapshot.pitches[0],canonicalPlayerId:'other'}]}},
      {...good,clue_snapshot:null},
      {...good,puzzle_id:'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000'},
    ];
    for(const row of invalid) expect(()=>decodeCustomLineupV2IssuedRow(row)).toThrow();
    await expect(reader({...good,puzzle_id:'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174001'})
      .repo.getById(ID)).rejects.toMatchObject({kind:'invalid-row'});
    await expect(reader(null).repo.getById(ID)).resolves.toBeNull();
    await expect(reader(null,{code:'08006'}).repo.getById(ID)).rejects.toMatchObject({kind:'query'});
    const noRead=reader(null);
    await expect(noRead.repo.getById('invalid')).rejects.toThrow();
    expect(noRead.from).not.toHaveBeenCalled();
  });
});
