import type { JSX } from 'react';
import { CLASSIC_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import type { DailyBootstrapRulesetVersion } from '../dailyRuntimeContracts';
import { isClassicInningEnabled } from '../gameAvailability';
import { getPacificDailyDateString } from '../getPacificDailyDateString';
import { dailyRuntime } from '../serverCanonicalRuntime';
import { DailyInningGame } from './DailyInningGame';
import { DailyModeNavigation } from './DailyModeNavigation';

type DailyModePageProps = {
  rulesetVersion: DailyBootstrapRulesetVersion;
};

type DailyModeConfig = {
  modeName: 'Daily Nine' | 'Classic Inning';
  path: '/' | '/classic';
  deck: string;
  instructions: string;
};

export async function DailyModePage({ rulesetVersion }: DailyModePageProps): Promise<JSX.Element> {
  const bootstrap = await dailyRuntime.getBootstrap(getPacificDailyDateString(), rulesetVersion);
  const mode = getModeConfig(bootstrap.rulesetVersion);

  return (
    <main className="page-shell">
      <section className="daily-card">
        <header className="daily-masthead">
          <div className="daily-brand-lockup">
            <span className="daily-brand-mark" aria-hidden="true">IB</span>
            <div>
              <p className="eyebrow">Initial Baseball</p>
              <h1>{mode.modeName}</h1>
              <p className="daily-deck">{mode.deck}</p>
            </div>
          </div>
          <div className="daily-header-tools">
            <span className="daily-edition" aria-label={`${mode.modeName} number ${bootstrap.puzzle.puzzleNumber}`}>
              {`Daily #${bootstrap.puzzle.puzzleNumber}`}
            </span>
            <details className="daily-instructions">
              <summary>How to play</summary>
              <p>{mode.instructions}</p>
            </details>
          </div>
        </header>

        <DailyModeNavigation
          currentPath={mode.path}
          classicInningEnabled={isClassicInningEnabled()}
        />

        <DailyInningGame
          puzzle={bootstrap.puzzle}
          rulesetVersion={bootstrap.rulesetVersion}
          initialProgressionToken={bootstrap.progressionToken}
          initialHintBundle={bootstrap.hintBundle}
        />

        <footer className="daily-footer">
          <span>One lineup every day.</span>
          <span>New puzzle · Midnight Pacific</span>
        </footer>
      </section>
    </main>
  );
}

function getModeConfig(rulesetVersion: DailyBootstrapRulesetVersion): DailyModeConfig {
  if (rulesetVersion === CLASSIC_DAILY_RULESET_VERSION) {
    return {
      modeName: 'Classic Inning',
      path: '/classic',
      deck: 'Guess today’s lineup before three outs.',
      instructions: 'A third wrong guess—or Give Up—records an out. Hits and walks move runners. Your inning ends after 3 outs or after the ninth at-bat.',
    };
  }

  return {
    modeName: 'Daily Nine',
    path: '/',
    deck: 'Guess today’s lineup from initials.',
    instructions: 'Each at-bat is worth up to 7 points. Every hint or wrong guess costs 1 point. Three wrong guesses—or Give Up—score 0 points. Play all 9 at-bats for up to 63 points.',
  };
}
