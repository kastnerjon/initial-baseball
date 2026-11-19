'use client';

import React, { type JSX, useEffect, useState } from 'react';
import { formatDailyShareText } from '@initial-baseball/engine';
import { createOfficialDailyCompetitiveHttpTransport } from '../officialDailyCompetitiveHttpTransport';
import type { restoreCompetitiveScorecard } from '../restoreCompetitiveScorecard';
import { createCompletedDailyShareResult } from '../dailyCompletedShareResult';
import { createDailyScorecardPoints } from '../dailyScorecard';
import { restoreCompetitiveHintSafely } from '../competitiveDailyLocalHint';
import { getBrowserDailyAtBatLockPort } from '../dailyAtBatOwnershipCoordinator';
import { DailyInningGame } from './DailyInningGame';
import { GameCompleteView } from './GameCompleteView';

export function CompetitiveDailyGame({ puzzleId, date }: { puzzleId: string; date: string }): JSX.Element {
  const [card, setCard] = useState<ReturnType<typeof restoreCompetitiveScorecard> | null>(null);
  const [localBootstrap, setLocalBootstrap] = useState<ReturnType<typeof restoreCompetitiveHintSafely> | null>(null);
  const [retry, setRetry] = useState(0);
  const [message, setMessage] = useState('Opening your scorecard…');
  useEffect(() => {
    let closed = false;
    const controller = new AbortController();
    let release = () => {};
    const held = new Promise<void>(resolve => { release = resolve; });
    async function play() {
      const locks = getBrowserDailyAtBatLockPort();
      if (!locks) { setMessage('This browser cannot safely open a competitive edition.'); return; }
      setMessage('Waiting to open this edition. Close it in any other tab.');
      await locks.requestExclusive('official-daily-competitive:' + puzzleId, controller.signal, async () => {
          if (closed) return;
          setMessage('Opening your scorecard…');
          const client = createOfficialDailyCompetitiveHttpTransport(puzzleId);
          let winner;
          try { winner = await client.scorecard(date); }
          catch {
            if (closed) return;
            await client.bootstrap(date);
            winner = await client.scorecard(date);
          }
          if (!closed) {
            if (winner.status === 'active') setLocalBootstrap(restoreCompetitiveHintSafely(winner.bootstrap));
            setCard(winner);
          }
          await held;
        });
    }
    void play().catch(() => { if (!closed) setMessage('Your scorecard could not be opened.'); });
    return () => { closed = true; controller.abort(); release(); };
  }, [puzzleId, date, retry]);
  if (!card) return <section aria-live="polite"><p>{message}</p>
    {message !== 'Opening your scorecard…' && <button onClick={() => setRetry(value => value + 1)}>Reload scorecard</button>}</section>;
  const path = '/daily/editions/' + puzzleId + '?date=' + date;
  if (card.status === 'completed') {
    const share = createCompletedDailyShareResult(card.gameState, true, path)!;
    return <GameCompleteView practiceOnly scorecardAnswers={card.scorecardAnswers} shareResult={share} shareText={formatDailyShareText(share)}
      atBatPoints={createDailyScorecardPoints(card.gameState.completedAtBats, card.gameState.rulesetVersion)} />;
  }
  const bootstrap = localBootstrap ?? card.bootstrap;
  return <DailyInningGame competitiveCard={card} puzzle={card.bootstrap.puzzle}
    rulesetVersion={card.bootstrap.rulesetVersion} initialProgressionToken={bootstrap.progressionToken}
    initialHintBundle={bootstrap.hintBundle} archivePath={path} />;
}
