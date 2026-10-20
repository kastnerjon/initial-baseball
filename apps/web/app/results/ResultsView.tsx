'use client';

import React, { useEffect, useState, type JSX } from 'react';
import {
  readBrowserCompletedGameHistory, type BrowserCompletedGameHistory,
} from '../browserCompletedGameHistory';

export function ResultsView(): JSX.Element {
  const [history, setHistory] = useState<BrowserCompletedGameHistory | null>(null);
  useEffect(() => {
    try { setHistory(readBrowserCompletedGameHistory(globalThis.localStorage)); }
    catch { setHistory({ status: 'unavailable' }); }
  }, []);
  return <ResultsList history={history} />;
}

export function ResultsList({ history }: {
  history: BrowserCompletedGameHistory | null;
}): JSX.Element {
  if (history === null) return <p role="status">Loading your saved results…</p>;
  if (history.status === 'unavailable') return <p role="status">Saved results aren’t available in this browser right now.</p>;
  return <>
    {history.unreadableRecords > 0 ? <p>Some saved results couldn’t be read.</p> : null}
    {history.games.length === 0 ? <p>No completed games are saved here yet.</p> : (
      <ul className="my-results-list" aria-label="Your completed games">
        {history.games.map(game => (
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
