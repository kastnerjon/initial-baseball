import type { JSX } from 'react';
import { CLASSIC_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import type { DailyBootstrapRulesetVersion } from '../dailyRuntimeContracts';
import { isClassicInningEnabled } from '../gameAvailability';
import { getPacificDailyDateString } from '../getPacificDailyDateString';
import { dailyRuntime } from '../serverCanonicalRuntime';
import { getDailyHowToContent } from '../dailyHowTo';
import { DailyHowToDialog } from './DailyHowToDialog';
import { DailyInningGame } from './DailyInningGame';
import { DailyModeNavigation } from './DailyModeNavigation';

type DailyModePageProps = {
  rulesetVersion: DailyBootstrapRulesetVersion;
};

type DailyModeConfig = {
  modeName: 'Daily Nine' | 'Classic Inning';
  path: '/' | '/classic';
  deck: string;
};

export async function DailyModePage({ rulesetVersion }: DailyModePageProps): Promise<JSX.Element> {
  const bootstrap = await dailyRuntime.getBootstrap(getPacificDailyDateString(), rulesetVersion);
  const mode = getModeConfig(bootstrap.rulesetVersion);
  const howTo = getDailyHowToContent(bootstrap.rulesetVersion);

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
            <DailyHowToDialog
              key={`${bootstrap.puzzle.id}:${bootstrap.rulesetVersion}`}
              content={howTo}
            />
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
          <a href="/archive">Play the archive</a>
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
    };
  }

  return {
    modeName: 'Daily Nine',
    path: '/',
    deck: 'Guess today’s lineup from initials.',
  };
}
