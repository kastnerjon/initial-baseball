import type { PostDailyResolutionJson } from './dailyGameplayResolutionClient';
import type { createOfficialDailyEditionHttpTransport } from './officialDailyEditionHttpTransport';

type EditionTransport = ReturnType<typeof createOfficialDailyEditionHttpTransport>;

/** Bind the shared resolution controller to the exact-ID, validated transport. */
export function createOfficialEditionResolutionTransport(puzzleId: string, edition: EditionTransport):
  { path: string; postJson: PostDailyResolutionJson } {
  const path = `/api/daily/editions/${puzzleId}/resolve`;
  const postJson: PostDailyResolutionJson = (requestPath, body) => {
    if (requestPath !== path || typeof body.progressionToken !== 'string') {
      throw new Error('Invalid official edition resolution request.');
    }
    const progressionToken = body.progressionToken;
    if (body.giveUp === true && Object.keys(body).length === 2) {
      return edition.resolve({ progressionToken, giveUp: true });
    }
    if (typeof body.submittedPlayerId === 'string' && Object.keys(body).length === 2) {
      return edition.resolve({ progressionToken, submittedPlayerId: body.submittedPlayerId });
    }
    throw new Error('Invalid official edition resolution request.');
  };
  return { path, postJson };
}
