'use client';

import React, { useEffect, useState, type JSX } from 'react';
import {
  readBrowserCompletedGameHistory, type BrowserCompletedGameHistory,
} from '../browserCompletedGameHistory';

export function ResultsView(): JSX.Element {
  const [history, setHistory] = useState<BrowserCompletedGameHistory | null>(null);
  const [archivePuzzleId, setArchivePuzzleId] = useState<string | null>(null);
  useEffect(() => {
    try { setHistory(readBrowserCompletedGameHistory(globalThis.localStorage)); }
    catch { setHistory({ status: 'unavailable' }); }
    const requested = new URLSearchParams((globalThis as { location?: { search?: string } }).location?.search ?? '').get('archivePuzzleId');
    if (requested !== null && /^archive-beta-v1-daily-[1-9]\d{0,5}$/.test(requested)) {
      setArchivePuzzleId(requested);
    }
  }, []);
  return <ResultsList history={history} archivePuzzleId={archivePuzzleId} />;
}

export function ResultsList({ history, archivePuzzleId = null }: {
  history: BrowserCompletedGameHistory | null;
  archivePuzzleId?: string | null;
}): JSX.Element {
  if (history === null) return <p role="status">Loading your saved results…</p>;
  if (history.status === 'unavailable') return <p role="status">Saved results aren’t available in this browser right now.</p>;
  const games = archivePuzzleId === null ? history.games
    : history.games.filter(game => game.mode === 'Archive' && game.puzzleId === archivePuzzleId);
  return <>
    {archivePuzzleId !== null ? <p><a href="/results">Show all saved results</a></p> : null}
    {history.unreadableRecords > 0 ? <p>Some saved results couldn’t be read.</p> : null}
    {games.length === 0 ? <p>{archivePuzzleId === null
      ? 'No completed games are saved here yet.'
      : 'No completed result is saved here for this archive puzzle.'}</p> : (
      <ul className="my-results-list" aria-label="Your completed games">
        {games.map(game => (
          <li key={game.key}>
            <details className="my-result">
              <summary>
                <span className="my-result-title">{game.mode} #{game.puzzleNumber}
                  <time dateTime={game.puzzleDate}>{game.puzzleDate}</time>
                </span>
                <strong className="my-result-score">{game.maximum === null
                  ? game.score + ' runs' : game.score + ' / ' + game.maximum}</strong>
                <span className="my-result-open">View results</span>
              </summary>
              <p className="my-result-status">{game.submissionStatus === 'submitted'
                ? 'Saved result' : 'Saved locally · not confirmed as submitted'}</p>
              <table className="my-result-table">
                <caption>{game.mode} #{game.puzzleNumber} · At-bat results</caption>
                <thead><tr><th scope="col">AB</th><th scope="col">Initials</th>
                  <th scope="col">Outcome</th><th scope="col">{game.maximum === null ? 'Runs' : 'Points'}</th></tr></thead>
                <tbody>{game.atBats.map(atBat => <tr key={atBat.pitchNumber}>
                  <th scope="row">{atBat.pitchNumber}</th><td>{atBat.initials}</td>
                  <td>{atBat.outcome}</td><td>{atBat.score}</td>
                </tr>)}</tbody>
              </table>
            </details>
          </li>
        ))}
      </ul>
    )}
  </>;
}
