import { describe, expect, it, vi } from 'vitest';
import type { CanonicalPlayerReveal } from '@initial-baseball/baseball-data/runtime';
import { DEFAULT_DAILY_HINT_CONFIG, DEFAULT_DAILY_STATS_HINT_CONFIG, type DailyPuzzle } from '@initial-baseball/shared';
import { createDailyProgressionTokenCodec } from './dailyProgressionToken';
import { createDailyRuntimeService } from './dailyRuntimeService';

// Test only: no unrevealed career data enters a request or snapshot.
vi.mock('./canonicalRevealViewModel', () => ({
  createCanonicalRevealViewModel: () => ({ displayName: 'Redacted' }),
}));
const DATE='2026-11-03', ANSWER='ibp_ab000000000000000000', WRONG='ibp_cd000000000000000000';
function puzzle(puzzleDate:string): DailyPuzzle {
  return {
    id:'daily-'+puzzleDate,puzzleDate,puzzleNumber:1,status:'published',
    hintConfig:DEFAULT_DAILY_HINT_CONFIG,statsHintConfig:DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches:[1,2].map(pitchNumber=>({
      pitchNumber,
      player:{playerId:ANSWER,fullName:'Hidden Player',displayName:'Hidden Player',
        initials:'HP',kind:'hitter' as const,primaryPosition:'SS'},
      hints:{main_decade:'1990s',teams:'NYY',position:'SS',stats:'H 100'},
    })),
  };
}
function setup(maxStrikes?:1|2|3){
  const tokens=createDailyProgressionTokenCodec('qa-runtime-strikes-signed-test-secret-0123456789');
  const service=createDailyRuntimeService({
    createPuzzle:puzzle,progressionTokens:tokens,
    resolveLegacyPlayerId:()=>{throw Error('Legacy guess not supported');},
    getCanonicalReveal:id=>({playerId:id} as unknown as CanonicalPlayerReveal),
    ...(maxStrikes===undefined?{}:{maxStrikes}),
  });
  return {service,tokens};
}
describe('trusted runtime strike-cap option (Custom issuance still default three)',()=>{
  it.each([1,2,3] as const)('cap %i ends exactly the right at-bat and resets for the next',async cap=>{
    const {service,tokens}=setup(cap);
    let token=(await service.getBootstrap(DATE)).progressionToken;
    for(let wrong=1;wrong<=cap;wrong++){
      const out=await service.resolveAtBat({progressionToken:token,submittedPlayerId:WRONG});
      expect(out.result).toMatchObject(wrong===cap
        ?{kind:'strikeout',strikeCount:cap,outcome:'K'}
        :{kind:'incorrect',strikeCount:wrong});
      token=out.progressionToken;
    }
    expect(tokens.verify(token)).toMatchObject({
      pitchNumber:2,strikeCount:0,outCount:1,completed:false,
    });
    const next=await service.resolveAtBat({progressionToken:token,submittedPlayerId:WRONG});
    expect(next.result.kind).toBe(cap===1?'strikeout':'incorrect');
  });
  it.each([1,2,3] as const)('cap %i applies to Give Up without changing score mode',async cap=>{
    const {service,tokens}=setup(cap);
    const opening=await service.getBootstrap(DATE);
    const out=await service.resolveAtBat({progressionToken:opening.progressionToken,giveUp:true});
    expect(out.result).toMatchObject({kind:'strikeout',strikeCount:cap,outcome:'K'});
    expect(tokens.verify(out.progressionToken)).toMatchObject({
      pitchNumber:2,strikeCount:0,completed:false,
    });
  });
  it('keeps default three and fails closed for malformed caps and stale strike claims',async()=>{
    const {service}=setup();
    let token=(await service.getBootstrap(DATE)).progressionToken;
    for(const count of [1,2,3]){
      const out=await service.resolveAtBat({progressionToken:token,submittedPlayerId:WRONG});
      expect(out.result).toMatchObject(count===3
        ?{kind:'strikeout',strikeCount:3}
        :{kind:'incorrect',strikeCount:count});
      token=out.progressionToken;
    }
    for(const invalid of [0,4,-1,1.5,'2',Number.NaN]){
      expect(()=>setup(invalid as 1|2|3)).toThrow('Unsupported server-owned strike limit');
    }
    const one=setup(1);
    const opening=await one.service.getBootstrap(DATE);
    const claims=one.tokens.verify(opening.progressionToken);
    await expect(one.service.resolveAtBat({
      progressionToken:one.tokens.sign({...claims,strikeCount:1}),submittedPlayerId:WRONG,
    })).rejects.toThrow('strike count exceeds');
  });
});
