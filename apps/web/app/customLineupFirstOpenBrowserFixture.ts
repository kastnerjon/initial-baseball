/** Local-only browser acceptance fixture. Real services/HTTP; in-memory persistence. */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { vi } from 'vitest';
import { createCustomLineupIssuedChallenge, createCustomLineupIssuedClueSnapshot } from '@initial-baseball/daily';
import type { Player, DailyCompletedAtBat } from '@initial-baseball/shared';
import type { CanonicalPlayerReveal } from '@initial-baseball/baseball-data/runtime';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';
import type { CustomLineupV2AdmissionInput } from './supabaseCustomLineupV2AdmissionRepository';
import * as bootstrap from './serverCustomLineupV2AttemptBootstrap';
import * as hints from './serverCustomLineupV2AttemptHints';
import * as guesses from './serverCustomLineupV2IncorrectGuesses';
import * as admission from './serverCustomLineupV2CompletedAdmission';
import { handleCustomLineupV2GameplayPost } from './serverCustomLineupV2GameplayHttp';
import { createCustomLineupV2ProgressionTokens } from './serverCustomLineupV2Bootstrap';
import { CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';

export const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const IDS = [1, 2].map(i => 'ibp_' + i.toString(16).padStart(20, '0'));
const SECRET = 'local-fixture-only-not-a-deployed-credential-470';
export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}
export async function firstOpenFixture() {
  const rows = new Map<string, CustomNineAttemptState>();
  const completions = new Map<string, CustomLineupV2AdmissionInput>();
  const tokens = createCustomLineupV2ProgressionTokens(SECRET);
  const initial = tokens.sign({ version: 1, rulesetVersion: 'points-v4', puzzleId: ID,
    puzzleDate: CUSTOM_NINE_SESSION_DATE, pitchNumber: 1, revealCount: 0,
    strikeCount: 0, outCount: 0, completed: false });
  const challenge = createCustomLineupIssuedChallenge({ puzzleId: ID, issuedAt: '2026-10-22T12:00:00Z',
    canonicalPlayerIds: IDS.slice(0, 1), clueSnapshot: createCustomLineupIssuedClueSnapshot({
      hintLayout: [ {slot:1,hintType:'main_decade',displayLabel:'Decade'},
        {slot:2,hintType:'teams',displayLabel:'Teams'}, {slot:3,hintType:'position',displayLabel:'Position'},
        {slot:4,hintType:'stats',displayLabel:'Stats'} ],
      pitches: [{pitchNumber:1,canonicalPlayerId:IDS[0]!,initials:'P1',
        hintValues:['TEST_DECADE','TEST_TEAMS','TEST_POSITION','TEST_STATS']}],
    }) });
  const copy = (state: CustomNineAttemptState | undefined) => state ? structuredClone(state) : null;
  async function advance(expected: CustomNineAttemptState, next: string, fact?: DailyCompletedAtBat) {
    const old = rows.get(expected.browserKeyDigest);
    if (!old || old.status !== 'active' || old.revision !== expected.revision
      || old.currentProgressionToken !== expected.currentProgressionToken) return {status:'conflict' as const};
    const state: CustomNineAttemptState = {...old, revision:old.revision+1,currentProgressionToken:next,
      ...(fact ? {terminalAtBats:[fact],status:'completed',completedAt:'2026-10-22T13:00:00Z'} : {})};
    rows.set(old.browserKeyDigest, state);
    return {status:'advanced' as const,state:structuredClone(state)};
  }
  const repository = {
    getByKey: async (key: {browserKeyDigest:string}) => copy(rows.get(key.browserKeyDigest)),
    getOrCreate: async (key: {browserKeyDigest:string}, token:string) => {
      const old = rows.get(key.browserKeyDigest);
      const state: CustomNineAttemptState = old ?? { challengeId:ID,browserKeyDigest:key.browserKeyDigest,
        attemptId:randomUUID(),revision:0,currentProgressionToken:token,terminalAtBats:[],status:'active',
        createdAt:'2026-10-22T12:00:00Z',updatedAt:'2026-10-22T12:00:00Z',completedAt:null };
      rows.set(key.browserKeyDigest,state);
      return {status:old?'existing' as const:'inserted' as const,state:structuredClone(state)};
    }, advanceHint: advance, advanceTerminal: advance,
  };
  const dependencies = { readChallenge:async()=>challenge, repository:()=>repository, getSecret:()=>SECRET,
    resolvePlayer:(id:string)=>IDS.includes(id)?{id,fullName:'Test Player',displayName:'Test Player',
      primaryRole:'hitter',primaryPosition:'RF'} as Player:null,
    getReveal:(id:string)=>({playerId:id,displayName:'Test Player',playerType:'hitter',
      career:{primaryPosition:'RF',firstSeason:2001,lastSeason:2002,teamIds:[],batting:null,pitching:null,advanced:null},
      seasons:[]} as unknown as CanonicalPlayerReveal),
  };
  const opening = async () => ({ puzzleId:ID,rulesetVersion:'points-v4' as const,
    atBats:[{pitchNumber:1,initials:'P1'}],progressionToken:initial,
    hintBundle:{pitchNumber:1,revealedCount:0 as const,hints:[],checkpoints:[]} });
  const services = [
    bootstrap.createServerCustomLineupV2AttemptBootstrap({dependencies:{...dependencies,opening}}),
    hints.createServerCustomLineupV2AttemptHintService({dependencies}),
    guesses.createServerCustomLineupV2IncorrectGuessService({dependencies}),
    admission.createServerCustomLineupV2CompletedAdmissionService({dependencies:{getSecret:()=>SECRET,
      challenge:async()=>challenge,attempt:async(_id,digest)=>copy(rows.get(digest)),admit:async input=>{
        const old = completions.has(input.browserKeyDigest);
        completions.set(input.browserKeyDigest,input);
        return {status:old?'existing':'created',submissionId:input.submissionId};
      }}}),
  ] as const;
  vi.spyOn(bootstrap,'createServerCustomLineupV2AttemptBootstrap').mockReturnValue(services[0]);
  vi.spyOn(hints,'createServerCustomLineupV2AttemptHintService').mockReturnValue(services[1]);
  vi.spyOn(guesses,'createServerCustomLineupV2IncorrectGuessService').mockReturnValue(services[2]);
  vi.spyOn(admission,'createServerCustomLineupV2CompletedAdmissionService').mockReturnValue(services[3]);
  vi.stubEnv('CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED','true');
  // esbuild is already pinned transitively by Vite; no new production dependency.
  const require = createRequire(import.meta.url);
  const viteRequire = createRequire(createRequire(require.resolve('vitest/config')).resolve('vite'));
  const { build } = viteRequire('esbuild');
  const bundle = await build({ stdin:{contents:`
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {CustomLineupGame} from './custom/CustomLineupGame';
    const game=React.createElement(CustomLineupGame,{puzzleId:${JSON.stringify(ID)}});
    createRoot(document.getElementById('root')).render(location.search.includes('strict')
      ? React.createElement(React.StrictMode,null,game):game);`,resolveDir:import.meta.dirname,loader:'tsx'},
    bundle:true,write:false,platform:'browser',define:{'process.env.NODE_ENV':'"development"'} });
  const held = deferred(), received = deferred(), sent = deferred();
  const requests: {action:string;cookie:boolean;setCookie:boolean}[] = [];
  let origin = '';
  const server = createServer(async (req,res) => {
    try {
      if (req.url === '/bundle.js') { res.setHeader('content-type','text/javascript'); res.end(bundle.outputFiles[0].text); return; }
      if (req.url?.startsWith('/api/players/search')) {
        res.setHeader('content-type','application/json');
        res.end(JSON.stringify({results:[{playerId:IDS[1],displayName:'Wrong Player'}]})); return;
      }
      if (!req.url?.startsWith('/api/')) {
        res.setHeader('content-type','text/html');
        res.end('<!doctype html><meta name="viewport" content="width=device-width"><div id="root"></div><script src="/bundle.js"></script>'); return;
      }
      const action = req.url.split('/').at(-1) as 'bootstrap'|'hint'|'resolve'|'submit';
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      const headers = new Headers();
      for (const [key,value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(key,value);
      const reply = await handleCustomLineupV2GameplayPost(new Request(origin+req.url,{
        method:'POST',headers,...(body?{body}:{}) }),{params:Promise.resolve({puzzleId:ID})},action);
      const record = {action,cookie:!!req.headers.cookie,setCookie:reply.headers.has('set-cookie')};
      requests.push(record);
      const first = action === 'bootstrap' && requests.filter(r=>r.action==='bootstrap').length === 1;
      if (first) { received.resolve(); await held.promise; }
      res.writeHead(reply.status,Object.fromEntries(reply.headers));
      res.end(await reply.text());
      if (first) sent.resolve();
    } catch (error) { res.statusCode=500; res.end('Fixture failure'); console.error(error); }
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('missing local port');
  origin = 'http://127.0.0.1:'+address.port;
  return {origin,rows,completions,requests,held,received,sent,async close(){
    held.resolve(); server.closeAllConnections();
    await new Promise<void>(resolve=>server.close(()=>resolve()));
    vi.restoreAllMocks(); vi.unstubAllEnvs();
  }};
}
