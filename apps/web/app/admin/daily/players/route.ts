import { NextResponse } from 'next/server';
import { DAILY_ADMIN_AUTH_CHALLENGE, DailyAdminAuthorizationError, requireDailyAdminPrincipal } from '../../../dailyAdminAuthorization';
import { readBoundedDailyAdminFormText } from '../../../dailyAdminBoundedForm';
import { createDailyAdminContext } from '../../../dailyAdminComposition';
import { isFirstPartyDailyAdminForm } from '../../../dailyAdminRequestSecurity';
import { createDailyAdminWorkflow } from '../../../dailyAdminWorkflow';

const HEADERS = { 'cache-control': 'private, no-store', vary: 'Authorization',
  'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' } as const;
const reply = (status: number, error: string) => NextResponse.json({ error }, { status, headers: HEADERS });

/** Private primary-editor search and preview; values never enter navigation URLs. */
export async function POST(request: Request): Promise<NextResponse> {
  if (!isFirstPartyDailyAdminForm(request)) return reply(403, 'forbidden');
  if (new URL(request.url).search !== '' || request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
      !== 'application/x-www-form-urlencoded') return reply(415, 'invalid_request');
  const authorization = request.headers.get('authorization');
  try { requireDailyAdminPrincipal(authorization); }
  catch (error) {
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'unauthorized') {
      const response = reply(401, 'authentication_required');
      response.headers.set('www-authenticate', DAILY_ADMIN_AUTH_CHALLENGE);
      return response;
    }
    return reply(503, 'unavailable');
  }
  const body = await readBoundedDailyAdminFormText(request, 1024);
  if (body === null) return reply(413, 'invalid_request');
  const fields = new URLSearchParams(body);
  const keys = [...fields.keys()];
  const q = fields.get('q');
  const id = fields.get('playerId');
  const date = fields.get('puzzleDate');
  const slot = fields.get('slot');
  const search = keys.length === 1 && keys[0] === 'q' && q !== null && q.length <= 80
    && q.trim().length >= 2 && !/[\u0000-\u001f\u007f]/.test(q);
  const preview = keys.length === 3 && keys.includes('playerId') && keys.includes('puzzleDate') && keys.includes('slot')
    && id !== null && id.length > 0 && id.length <= 200 && !/[\u0000-\u001f\u007f]/.test(id)
    && date !== null && /^\d{4}-\d{2}-\d{2}$/.test(date) && slot !== null && /^[1-9]$/.test(slot);
  if (!search && !preview) return reply(400, 'invalid_request');
  try {
    const { repository } = createDailyAdminContext({ authorizationHeader: authorization });
    const workflow = createDailyAdminWorkflow(repository);
    if (search && q !== null) {
      const found = workflow.searchPlayers(q.trim());
      const results = found.slice(0, 25).map(player => ({
        canonicalPlayerId: player.canonicalPlayerId, displayName: player.displayName,
        yearsPlayedDisplay: player.yearsPlayedDisplay, requiresYearDisambiguation: player.requiresYearDisambiguation,
        playerType: player.playerType, primaryPosition: player.primaryPosition, teamsDisplay: player.teamsDisplay,
        recognizabilityRank: player.recognizabilityRank, revealReady: player.revealReady,
      }));
      return NextResponse.json({ results, hasMore: found.length > 25 }, { headers: HEADERS });
    }
    if (id === null || date === null || slot === null) return reply(400, 'invalid_request');
    const horizon = await workflow.getHorizon();
    if (!horizon.some(puzzle => puzzle.puzzleDate === date && puzzle.selections.some(item => item.slot === Number(slot))))
      return reply(404, 'not_found');
    const player = workflow.previewPlayer(id, date);
    if (player === null) return reply(404, 'not_found');
    const { batting, pitching, advanced } = player.reveal.career;
    const careerLines = [
      batting === null ? null : `Career batting: ${batting.homeRuns ?? '—'} HR · ${batting.battingAverage ?? '—'} AVG · ${advanced?.ops ?? '—'} OPS`,
      pitching === null ? null : `Career pitching: ${pitching.wins ?? '—'} W · ${pitching.saves ?? '—'} SV · ${pitching.earnedRunAverage ?? '—'} ERA · ${pitching.whip ?? '—'} WHIP`,
    ].filter((line): line is string => line !== null);
    return NextResponse.json({ preview: {
      canonicalPlayerId: player.canonicalPlayerId, displayName: player.displayName, initials: player.initials,
      playerType: player.reveal.playerType, firstSeason: player.reveal.career.firstSeason,
      lastSeason: player.reveal.career.lastSeason, position: player.reveal.career.primaryPosition ?? 'Unknown',
      teams: player.reveal.career.teamIdentities?.map(team => team.abbreviation).join(', ')
        || player.reveal.career.teamIds.join(', ') || 'Teams unavailable',
      careerLines, seasonCount: player.reveal.seasons.length,
      hints: player.hints.map(hint => ({ hintLabel: hint.hintLabel, hintValue: hint.hintValue })),
    } }, { headers: HEADERS });
  } catch { return reply(503, 'unavailable'); }
}
