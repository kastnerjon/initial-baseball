import { createServer } from 'node:http';

export const date = '2026-11-06';
export const ids = [
  'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08',
  'daily-ed-v1-2a65c93c-3f36-4f4b-853f-92e85bb81648',
  'daily-2026-11-06-editorial-03e21d89',
];

/** Static loopback fixture: real browser persistence, no gameplay server or DB. */
export async function serveIsolationFixture(bundle) {
  const script = `
    const { getDailyModeStorage, createInitialDailyGameState, createInitialAtBatUiState,
      saveDailyGame, loadSavedDailyGame, clearSavedDailyGame,
      createBrowserDailyAtBatOwnershipCoordinator } = IBDailyIsolationQA;
    const ids = ${JSON.stringify(ids)};
    const date = ${JSON.stringify(date)};
    const id = ids[Number(new URL(location.href).searchParams.get('edition') ?? 0)];
    const puzzle = { id, puzzleDate: date, puzzleNumber: 194, status: 'published',
      pitches: Array.from({ length: 9 }, (_, i) => ({ pitchNumber: i + 1, initials: 'QA' })) };
    const storage = getDailyModeStorage('points-v4', localStorage, id);
    window.read = () => loadSavedDailyGame(puzzle, 'FIXTURE-INITIAL', storage);
    window.save = (count, strikes) => {
      const atBatState = { ...createInitialAtBatUiState(), revealCount: count,
        strikeCount: strikes, revealedHints: Array.from({ length: count }, (_, i) =>
          ({ hintType: 'teams', hintLabel: 'Fixture ' + (i + 1), hintValue: 'Synthetic ' + id })) };
      return saveDailyGame(puzzle, { currentPitchIndex: 0,
        gameState: createInitialDailyGameState(puzzle, 'points-v4'), atBatState,
        pendingAdvance: null, progressionToken: 'FIXTURE-' + id + '-' + count + '-' + strikes }, storage);
    };
    window.reset = () => clearSavedDailyGame(puzzle, storage);
    window.events = [];
    window.claim = () => {
      window.coordinator?.stop();
      window.coordinator = createBrowserDailyAtBatOwnershipCoordinator({
        identity: { id, puzzleDate: date, puzzleNumber: 194, rulesetVersion: 'points-v4' },
        journal: { read: () => ({ kind: 'missing' }), advanceGeneration: () => 'unavailable' },
        reloadDurableState: () => { window.reloaded = window.read(); },
        onStorageSignal: key => window.events.push(key),
      });
      window.coordinator.start();
    };
    window.ready = true;
  `;
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.url === '/bundle.js') {
      response.setHeader('Content-Type', 'text/javascript'); response.end(bundle); return;
    }
    if (request.url === '/fixture.js') {
      response.setHeader('Content-Type', 'text/javascript'); response.end(script); return;
    }
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><html><title>Daily persistence fixture</title>'
      + '<script src="/bundle.js"></script><script src="/fixture.js"></script></html>');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject); server.listen(0, '127.0.0.1', resolve);
  });
  return { url: 'http://127.0.0.1:' + server.address().port,
    close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
