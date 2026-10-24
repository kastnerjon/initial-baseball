'use client';

import React, { useEffect, useState, type JSX } from 'react';
import {
  readBrowserCompletedGameHistory, type BrowserCompletedGameHistory,
} from '../browserCompletedGameHistory';

export type IssuedArchiveListEntry = Readonly<{
  dailyNumber: number;
  puzzleDate: string;
}>;

/** Browser-local summary only; server-issued archive identities remain authoritative. */
export function ArchiveLocalResults({ puzzles }: {
  puzzles: readonly IssuedArchiveListEntry[];
}): JSX.Element {
  const [history, setHistory] = useState<BrowserCompletedGameHistory | null>(null);
  useEffect(() => {
    try { setHistory(readBrowserCompletedGameHistory(globalThis.localStorage)); }
    catch { setHistory({ status: 'unavailable' }); }
  }, []);
  return <ArchiveLocalResultsList puzzles={puzzles} history={history} />;
}

/** Intentionally does not infer "unplayed" from missing completed-result storage. */
export function ArchiveLocalResultsList({ puzzles, history }: {
  puzzles: readonly IssuedArchiveListEntry[];
  history: BrowserCompletedGameHistory | null;
}): JSX.Element {
  return <ul aria-label="Issued archive puzzles">
    {puzzles.map(puzzle => {
      const puzzleId = 'archive-beta-v1-daily-' + puzzle.dailyNumber;
      const completions = history?.status === 'ready'
        ? history.games.filter(game => game.mode === 'Archive'
          && game.puzzleId === puzzleId
          && game.puzzleDate === puzzle.puzzleDate
          && game.puzzleNumber === puzzle.dailyNumber)
        : [];
      return <li key={puzzle.dailyNumber} style={{ padding: '12px 0' }}>
        <a href={'/archive/' + puzzle.dailyNumber}>
          Archive beta #{puzzle.dailyNumber} · {puzzle.puzzleDate}
        </a>
        {completions.length === 0 ? <span> · Play / resume</span> : (
          <ul aria-label={'Your saved results for archive beta ' + puzzle.dailyNumber}>
            {completions.map(game => <li key={game.key}>
              {game.submissionStatus === 'submitted' ? 'Saved here' : 'Saved locally (submission not confirmed)'}
              {' · '}{game.maximum === null ? game.score + ' runs' : game.score + ' / ' + game.maximum}
              {' · '}{game.rulesetVersion}
              {' · '}<a href={'/results?archivePuzzleId=' + encodeURIComponent(puzzleId)}>
                View at-bat details
              </a>
            </li>)}
          </ul>
        )}
      </li>;
    })}
  </ul>;
}
