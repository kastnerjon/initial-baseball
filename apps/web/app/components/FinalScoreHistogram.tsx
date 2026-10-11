'use client';
import { useState, type JSX } from 'react';
import type { DailyNineCompletedComparisonState } from '../useDailyNineCompletedComparison';
import { createFinalDistributionModel } from '../dailyScoreDistributionModels';

export function FinalScoreHistogram({ comparison }: { comparison: DailyNineCompletedComparisonState }): JSX.Element {
  const model = createFinalDistributionModel(comparison);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const selected = model.status === 'ready'
    ? model.bins.find(bin => bin.score === selectedScore) ?? null : null;
  const markerX = ((model.markerIndex ?? 0) + 0.5) * 10;
  return (
    <section className="score-distribution-panel" aria-label="Final score distribution">
      <h2>Final Score Distribution</h2>
      <p>How many total points other players scored in this game.</p>
      {model.status !== 'ready' ? (
        <p className="score-dist-empty" role="status">
          {model.status === 'loading' ? 'Loading score distribution…'
            : model.status === 'empty' ? 'Waiting for another completed game.'
            : 'Final score distribution unavailable.'}
        </p>
      ) : (
        <>
          <div className="score-final-graph">
            <svg viewBox="0 0 730 150" role="group" aria-label={'Completed scores from ' + model.min + ' through ' + model.max + ', ' + model.count + ' other games'} preserveAspectRatio="none">
              <line x1="0" x2="730" y1="132" y2="132" className="score-final-baseline" />
              {model.bins.map((bin, index) => bin.count === 0 ? null : (
                <rect key={bin.score} x={index * 10 + 1} y={132 - bin.height}
                  width="8" height={bin.height} rx="1" className={selectedScore === bin.score ? 'score-final-bar score-final-bar-active' : 'score-final-bar'}
                  role="button" tabIndex={0}
                  aria-label={bin.score + ' points: ' + bin.count + ' results, ' + bin.percent.toFixed(1) + '%'}
                  onClick={() => setSelectedScore(bin.score)}
                  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedScore(bin.score); } }}
                ><title>{bin.score + ' points · ' + bin.count + ' results'}</title></rect>
              ))}
              <line x1={markerX} x2={markerX} y1="28" y2="132" className="score-final-marker-line" />
              <rect x={Math.min(689, Math.max(1, markerX - 22))} y="2" width="44" height="24" rx="5" className="score-final-marker-box" />
              <text x={Math.min(711, Math.max(23, markerX))} y="18" textAnchor="middle" className="score-final-marker-text">{model.own}</text>
            </svg>
          </div>
          <div className="score-final-ticks" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => <span key={i}>{model.min + (model.max - model.min) * i / 4}</span>)}
          </div>
          <label className="score-final-select">
            <span>Explore score</span>
            <input type="range" min={model.min} max={model.max} step={model.step}
              value={selectedScore ?? model.own ?? model.min}
              onChange={event => setSelectedScore(Number((event.target as unknown as { value: string }).value))}
              aria-label="Inspect completed-game score bucket" />
          </label>
          <p className="score-dist-detail" role="status" aria-live="polite">
            {selected === null ? 'Your score: ' + model.own + ' points. Select a bar or use the slider to inspect the other results.'
              : selected.score + ' points · ' + selected.count + ' completed game' + (selected.count === 1 ? '' : 's')
                + ' · ' + selected.percent.toFixed(1) + '% of ' + model.count + ' other results'}
          </p>
        </>
      )}
    </section>
  );
}
