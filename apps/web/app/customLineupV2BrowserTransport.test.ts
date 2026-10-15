import { describe, expect, it, vi } from 'vitest';
import { createCustomLineupV2BrowserTransport } from './customLineupV2BrowserTransport';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const pitches = (n: number) => Array.from({length:n},(_,i)=>({
  pitchNumber:i+1,initials:'P'+(i+1),
}));
const fact = (i:number) => ({pitchNumber:i+1,initials:'P'+(i+1),
  outcome:'HR',hintsRevealed:0,wrongGuesses:0,resolution:'correct'});
const hint = {slot:1,hintType:'main_decade',hintLabel:'Decade',hintValue:'1980s'};
const bundle = (pitchNumber:number, hints:unknown[]=[]) => ({
  pitchNumber,revealedCount:hints.length,hints,checkpoints:[],
});
const opening = (n:number) => ({
  attemptMode:'reserved',puzzleId:ID,rulesetVersion:'points-v4',
  atBats:pitches(n),progressionToken:'signed-start',hintBundle:bundle(1),
  attemptProgress:{strikeCount:0,completedAtBats:[]},
});
const reveal = {
  playerId:'ibp_'+'a'.repeat(20),displayName:'Correct Player',
  playerType:'hitter',primaryPosition:'LF',yearsPlayedDisplay:'1990–2000',teamIds:['NYM'],
  career:{lines:[{kind:'hitter',stats:{HR:42}}]},seasons:[],
};
const correct = {kind:'correct',outcome:'HR',revealedCount:0,source:'initials'};
const ok = (x:unknown) => Response.json(x);
const err = (status:number,error:string) => Response.json({error},{status});
function setup(replies:Response[]) {
  const request=vi.fn(async (_url:string,_init:RequestInit)=>{
    const response=replies.shift();
    if(!response)throw Error('No reply');
    return response;
  });
  return {request,client:createCustomLineupV2BrowserTransport(request)};
}
const URL='/api/custom-lineup/challenges/'+ID+'/attempt/';

describe('Custom Lineup v2 strict browser transport, 1–10',()=>{
  it.each([1,5,9,10])('loads N=%i redacted opening through same-origin POST',async n=>{
    const s=setup([ok({...opening(n),PRIVATE_EXTRA:'PRIVATE_SECRET'})]);
    expect(await s.client.bootstrap(ID)).toEqual(opening(n));
    expect(s.request).toHaveBeenCalledWith(URL+'bootstrap',{
      method:'POST',credentials:'same-origin',
    });
    expect(JSON.stringify(s.request.mock.calls)).not.toContain('attemptId');
  });

  it.each([1,5,9,10])('restores N=%i accepted signed depth/strikes at current batter',async n=>{
    const pre=Math.min(n-1,2);
    const expected={
      ...opening(n),progressionToken:'signed-progressed',
      hintBundle:bundle(pre+1,[hint]),
      attemptProgress:{strikeCount:2,completedAtBats:Array.from({length:pre},(_,i)=>fact(i))},
    };
    const s=setup([ok(expected)]);
    expect(await s.client.bootstrap(ID)).toEqual(expected);
  });

  it.each([1,5,9,10])('reads N=%i completed terminal facts without a live token',async n=>{
    const data={attemptMode:'completed',atBats:pitches(n),
      completedAtBats:Array.from({length:n},(_,i)=>fact(i)),
      revision:n,completedAt:'2026-10-15T12:00:00Z',PRIVATE_ANSWER:'hidden'};
    const s=setup([ok(data)]);
    const actual=await s.client.bootstrap(ID);
    expect(actual).toEqual({
      attemptMode:'completed',atBats:data.atBats,
      completedAtBats:data.completedAtBats,revision:n,completedAt:data.completedAt,
    });
    expect(actual).not.toHaveProperty('progressionToken');
    expect(JSON.stringify(actual)).not.toContain('PRIVATE_ANSWER');
  });

  it('allows a noncompetitive creator preview but no attempt-progress authority',async()=>{
    const creator={...opening(3),attemptMode:'creator_preview'};
    const {attemptProgress:_ignored,...visible}=creator;
    const s=setup([ok(visible)]);
    expect(await s.client.bootstrap(ID)).toEqual(visible);
    const broken=setup([ok(creator)]);
    await expect(broken.client.bootstrap(ID)).rejects.toMatchObject({kind:'invalid_response'});
  });

  it('never accepts fake future hints, wrong batter counts, unauthorized checkpoints or bad facts',async()=>{
    const base=opening(5);
    for(const mutated of [
      {...base,atBats:pitches(11)},
      {...base,puzzleId:'other'},
      {...base,hintBundle:bundle(2)},
      {...base,hintBundle:{...bundle(1),checkpoints:[{revealedCount:1,progressionToken:'future'}]}},
      {...base,hintBundle:{...bundle(1),hints:[hint]}},
      {...base,attemptProgress:{...base.attemptProgress,completedAtBats:[fact(0)]}},
      {...base,attemptProgress:{...base.attemptProgress,completedAtBats:[{...fact(0),initials:'BAD'}]}},
      {...base,attemptProgress:{...base.attemptProgress,strikeCount:3}},
    ]){
      const s=setup([ok(mutated)]);
      await expect(s.client.bootstrap(ID)).rejects.toMatchObject({kind:'invalid_response'});
    }
  });

  it('requests signed single hints and validates returned shape',async()=>{
    const data={hint:{hintType:'main_decade',hintLabel:'Decade',hintValue:'1980s'},
      progressionToken:'signed-hint',revision:3,privateAnswer:'PRIVATE_ANSWER'};
    const s=setup([ok(data)]);
    expect(await s.client.revealHint(ID,'signed-current')).toEqual({
      hint:data.hint,progressionToken:'signed-hint',revision:3,
    });
    expect(s.request).toHaveBeenCalledWith(URL+'hint',{
      method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
      body:JSON.stringify({progressionToken:'signed-current'}),
    });
    const failure=setup([ok({...data,hint:{...data.hint,hintValue:''}})]);
    await expect(failure.client.revealHint(ID,'signed-current'))
      .rejects.toMatchObject({kind:'invalid_response'});
  });

  it('accepts incorrect and terminal results with exact N=1/10 next-batter invariant',async()=>{
    const result={kind:'terminal',result:correct,
      reveal:{...reveal,privateAnswer:'PRIVATE_ANSWER'},
      progressionToken:'signed-next',revision:1,completed:false,
      hintBundle:bundle(2)};
    const s=setup([ok({kind:'incorrect',strikeCount:1,revision:1,
      progressionToken:'signed-wrong'}),ok(result)]);
    expect(await s.client.resolve(ID,'signed-open',1,10,{submittedPlayerId:reveal.playerId}))
      .toEqual({kind:'incorrect',strikeCount:1,revision:1,progressionToken:'signed-wrong'});
    const terminal=await s.client.resolve(ID,'signed-wrong',1,10,{submittedPlayerId:reveal.playerId});
    expect(terminal.kind).toBe('terminal');
    expect(JSON.stringify(terminal)).not.toContain('PRIVATE_ANSWER');
    expect(s.request).toHaveBeenLastCalledWith(URL+'resolve',{
      method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
      body:JSON.stringify({progressionToken:'signed-wrong',submittedPlayerId:reveal.playerId}),
    });
    const final=setup([ok({...result,completed:true,hintBundle:null})]);
    expect((await final.client.resolve(ID,'signed-last',1,1,{giveUp:true})).kind).toBe('terminal');
    const wrongFinal=setup([ok({...result,completed:false,hintBundle:null})]);
    await expect(wrongFinal.client.resolve(ID,'signed-last',1,1,{giveUp:true}))
      .rejects.toMatchObject({kind:'invalid_response'});
  });

  it('blocks forged out-of-range requests before network and rejects missing next-batter bundle',async()=>{
    const s=setup([]);
    for(const [pitch,n] of [[0,1],[11,10],[1,0],[1,11]] as const){
      await expect(s.client.resolve(ID,'signed',pitch,n,{giveUp:true}))
        .rejects.toMatchObject({kind:'invalid_request'});
    }
    await expect(s.client.resolve(ID,'signed',1,10,{submittedPlayerId:'A R'}))
      .rejects.toMatchObject({kind:'invalid_request'});
    await expect(s.client.bootstrap('daily-1')).rejects.toMatchObject({kind:'invalid_request'});
    expect(s.request).not.toHaveBeenCalled();
    const result={kind:'terminal',result:correct,reveal,progressionToken:'signed-next',
      revision:1,completed:false,hintBundle:null};
    const invalidNext=setup([ok(result)]);
    await expect(invalidNext.client.resolve(ID,'signed-current',1,10,{giveUp:true}))
      .rejects.toMatchObject({kind:'invalid_response'});
  });

  it('submits bodyless, accepts exact replay, and handles disabled/conflict/provider errors',async()=>{
    const s=setup([ok({status:'created',hidden:'PRIVATE'}),ok({status:'existing'})]);
    expect(await s.client.submit(ID)).toBe('created');
    expect(await s.client.submit(ID)).toBe('existing');
    expect(s.request).toHaveBeenCalledWith(URL+'submit',{
      method:'POST',credentials:'same-origin',
    });
    for(const [status,error,kind] of [
      [404,'not_found','not_found'],[403,'forbidden','invalid_credential'],
      [409,'conflict','conflict'],[409,'completed','completed'],
      [503,'session_unavailable','unavailable'],
    ] as const){
      const client=setup([err(status,error)]).client;
      await expect(client.bootstrap(ID)).rejects.toMatchObject({kind});
    }
    await expect(setup([ok({status:'unknown'})]).client.submit(ID))
      .rejects.toMatchObject({kind:'invalid_response'});
    await expect(setup([]).client.submit(ID)).rejects.toMatchObject({kind:'unavailable'});
  });
});
