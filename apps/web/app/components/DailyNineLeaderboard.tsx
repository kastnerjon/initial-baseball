'use client';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import type { DailyCompletedAtBat, DailyPublicPuzzle } from '@initial-baseball/shared';
import { submitCompletedDailyResultIfNeeded } from '../dailyCompletedResultClient';
import { readDailyNineLeaderboard, readOwnDailyNineLeaderboardRank, submitDailyNineLeaderboardName, type DailyNineLeaderboardView } from '../dailyNineLeaderboardClient';

type Props = {
  puzzle: Pick<DailyPublicPuzzle, 'id' | 'puzzleDate' | 'puzzleNumber'>;
  completedAtBats: DailyCompletedAtBat[];
  attemptId: string | null;
};
export function DailyNineLeaderboard({ puzzle, completedAtBats, attemptId }: Props): JSX.Element {
  const [view, setView] = useState<DailyNineLeaderboardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setUnavailable(false);
    void (async () => {
      try {
        let result = await readDailyNineLeaderboard(puzzle, controller.signal);
        if (attemptId !== null) {
          try {
            result = await readOwnDailyNineLeaderboardRank(attemptId, controller.signal);
          } catch {
            // A valid first attempt is not necessarily a named leaderboard entry.
          }
        }
        if (!controller.signal.aborted) { setView(result); setLoading(false); }
      } catch {
        if (!controller.signal.aborted) { setLoading(false); setUnavailable(true); }
      }
    })();
    return () => controller.abort();
  }, [puzzle.id, puzzle.puzzleDate, puzzle.puzzleNumber, attemptId]);

  const own = view?.ownEntry ?? null;
  return (
    <section className="daily-nine-leaderboard" aria-label="Daily Nine leaderboard">
      <div className="daily-nine-leaderboard-heading">
        <div>
          <p className="daily-nine-leaderboard-eyebrow">Daily #{puzzle.puzzleNumber}</p>
          <h2>Today's Top 10</h2>
        </div>
        <span className="daily-nine-leaderboard-count">{view?.totalEntries ?? 0} named entries</span>
      </div>
      {loading ? <p className="daily-nine-leaderboard-status" role="status">Loading leaderboard…</p>
        : unavailable ? <p className="daily-nine-leaderboard-status">Leaderboard unavailable right now.</p>
        : view?.leaders.length ? (
          <ol className="daily-nine-leaderboard-list">
            {view.leaders.map((entry, index) => (
              <li className="daily-nine-leaderboard-row" key={index}>
                <span className="daily-nine-leaderboard-rank">{entry.rank}</span>
                <span className="daily-nine-leaderboard-name">{entry.displayName}</span>
                <strong className="daily-nine-leaderboard-score">{entry.points} PTS</strong>
              </li>
            ))}
          </ol>
        ) : <p className="daily-nine-leaderboard-status">No named scores yet. You could be first.</p>}
      {own !== null ? <p className="daily-nine-leaderboard-own" role="status">
        Your rank: #{own.rank} of {view?.totalEntries} · {own.points} points
      </p> : attemptId !== null ? (
        <form className="daily-nine-leaderboard-form" onSubmit={(event) => {
          event.preventDefault();
          void submitName();
        }}>
          <label htmlFor="daily-nine-leaderboard-name">Add your first-attempt score</label>
          <div className="daily-nine-leaderboard-fields">
            <input id="daily-nine-leaderboard-name" type="text" maxLength={32}
              placeholder="Name or nickname" autoComplete="nickname"
              value={name} onChange={(event) => {
                const next = 'value' in event.target && typeof event.target.value === 'string'
                  ? event.target.value : '';
                setName(next);
              }}
              disabled={submitting} required />
            <button className="button-primary" type="submit" disabled={submitting || name.trim().length === 0}>
              {submitting ? 'Submitting…' : 'Submit score'}
            </button>
          </div>
          <p className="daily-nine-leaderboard-note">Optional. Your name and score will be public. Only your first attempt counts.</p>
        </form>
      ) : <p className="daily-nine-leaderboard-note">Only the first eligible attempt can be submitted. Replays do not qualify.</p>}
      {message === null ? null : <p className="daily-nine-leaderboard-status" role="status">{message}</p>}
    </section>
  );

  async function submitName(): Promise<void> {
    if (attemptId === null || submitting || name.trim().length === 0) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const state = await submitCompletedDailyResultIfNeeded({
        puzzle, rulesetVersion: 'points-v4', completedAtBats,
      }, { allowCreate: false });
      if (state !== 'submitted') {
        setMessage('Your first result has not been recorded yet. Please try again.');
        return;
      }
      const updated = await submitDailyNineLeaderboardName(attemptId, name.trim());
      setView(updated);
      setName('');
    } catch {
      setMessage('Could not submit your name. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }
}
