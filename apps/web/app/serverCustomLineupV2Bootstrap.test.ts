import {
  createCustomLineupIssuedChallenge, createCustomLineupIssuedClueSnapshot,
} from '@initial-baseball/daily';
import type { Player } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import {
  createCustomLineupV2ProgressionTokens, createServerCustomLineupV2BootstrapService,
} from './serverCustomLineupV2Bootstrap';
import { createDailyProgressionTokenCodec } from './dailyProgressionToken';
import { createCustomNineProgressionTokens } from './serverCustomNineBootstrap';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const SECRET = 'long-secret-for-independent-signed-custom-lineup-v2-tests';
const IDS = Array.from({length:10}, (_,i) => 'ibp_' + (i+1).toString(16).padStart(20,'0'));
function challenge(n: number) {
  return createCustomLineupIssuedChallenge({
    puzzleId: ID, issuedAt: '2026-10-14T15:00:00Z',
    canonicalPlayerIds: IDS.slice(0,n),
    clueSnapshot: createCustomLineupIssuedClueSnapshot({
      hintLayout: [
        {slot:1,hintType:'main_decade',displayLabel:'Decade'},
        {slot:2,hintType:'teams',displayLabel:'Teams'},
        {slot:3,hintType:'position',displayLabel:'Position'},
        {slot:4,hintType:'stats',displayLabel:'Stats'},
      ],
      pitches: IDS.slice(0,n).map((canonicalPlayerId,i)=>({
        pitchNumber:i+1,canonicalPlayerId,initials:'P'+(i+1),
        hintValues:i===0?['first decade','first teams','first position','first stat']:
          ['PRIVATE_FUTURE_CLUE','PRIVATE_FUTURE_CLUE','PRIVATE_FUTURE_CLUE','PRIVATE_FUTURE_CLUE'],
      })),
    }),
  });
}
function setup(value: unknown) {
  const deps={
    createSupabaseClient: vi.fn(()=>({} as SupabaseClient)),
    readChallenge: vi.fn(async()=>value as ReturnType<typeof challenge>|null),
    resolvePlayer: vi.fn((id:string):Player|null => IDS.includes(id)
      ? {id,fullName:'PRIVATE_ANSWER_NAME',displayName:'PRIVATE_ANSWER_NAME',
          primaryRole:'hitter',primaryPosition:'RF'} as Player : null),
    getSecret: vi.fn(()=>SECRET),
  };
  return {deps,service:createServerCustomLineupV2BootstrapService({dependencies:deps})};
}
describe('private Custom Lineup v2 signed opening',()=>{
  it.each([1,5,9,10])('opens immutable %i at-bats with no future answers',async n=>{
    const {service,deps}=setup(challenge(n));
    const result=await service.bootstrap(ID);
    expect(result?.atBats).toHaveLength(n);
    expect(result?.atBats[n-1]).toEqual({pitchNumber:n,initials:'P'+n});
    expect(result?.hintBundle.pitchNumber).toBe(1);
    expect(result?.hintBundle.hints.map(h=>h.hintValue))
      .toEqual(['first decade','first teams','first position','first stat']);
    const signed=createCustomLineupV2ProgressionTokens(SECRET);
    expect(signed.verify(result!.progressionToken)).toMatchObject({
      puzzleId:ID,pitchNumber:1,rulesetVersion:'points-v4',completed:false,
    });
    expect(result?.hintBundle.checkpoints).toHaveLength(4);
    const json=JSON.stringify(result);
    for(const privateValue of ['PRIVATE_FUTURE_CLUE','PRIVATE_ANSWER_NAME','canonicalPlayerIds','clueSnapshot',...IDS])
      expect(json).not.toContain(privateValue);
    expect(deps.resolvePlayer).toHaveBeenCalledTimes(n);
  });
  it('rejects short master secrets before deriving the isolated signing key',()=>{
    for(const secret of ['', 'guessable', 'x'.repeat(31)]) {
      expect(()=>createCustomLineupV2ProgressionTokens(secret)).toThrow('at least 32');
    }
    expect(()=>createCustomLineupV2ProgressionTokens('x'.repeat(32))).not.toThrow();
  });
  it('isolates v2 pitch ten from Daily and old Custom Nine tokens',()=>{
    const v2=createCustomLineupV2ProgressionTokens(SECRET);
    const claims={version:1 as const,rulesetVersion:'points-v4' as const,puzzleId:ID,
      puzzleDate:'1970-01-01',pitchNumber:10,revealCount:0 as const,
      strikeCount:0 as const,outCount:0 as const,completed:false};
    const token=v2.sign(claims);
    expect(v2.verify(token)).toEqual(claims);
    expect(()=>createDailyProgressionTokenCodec(SECRET).verify(token)).toThrow();
    expect(()=>createCustomNineProgressionTokens(SECRET).verify(token)).toThrow();
    expect(()=>createDailyProgressionTokenCodec(SECRET).sign(claims)).toThrow();
    expect(()=>createCustomNineProgressionTokens(SECRET).sign(claims)).toThrow();
    expect(()=>v2.verify(createCustomNineProgressionTokens(SECRET).sign({...claims,pitchNumber:9}))).toThrow();
  });
  it('rejects invalid/v1 IDs without reading and missing/mismatched challenges',async()=>{
    const current=setup(challenge(1));
    for (const id of ['',42,'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000']) {
      expect(await current.service.bootstrap(id)).toBeNull();
    }
    expect(current.deps.readChallenge).not.toHaveBeenCalled();
    expect(await setup(null).service.bootstrap(ID)).toBeNull();
    const wrong=setup({...challenge(1),puzzleId:'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174001'});
    await expect(wrong.service.bootstrap(ID)).rejects.toThrow('identity mismatch');
    await expect(setup({...challenge(1),schemaVersion:1}).service.bootstrap(ID)).rejects.toThrow();
  });
});
