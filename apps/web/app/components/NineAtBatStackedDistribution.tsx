'use client';
import React, { useState, type JSX } from 'react';
import { createAtBatDistributionModels, scoreValueLabels } from '../dailyScoreDistributionModels';
import type { DailyScorecardPoints } from '../dailyScorecard';
import type { DailyNineScorecardComparisons } from '../useDailyNineScorecardComparisons';

export function NineAtBatStackedDistribution({ points, comparisons }: {
  points: DailyScorecardPoints; comparisons: DailyNineScorecardComparisons;
}): JSX.Element {
  const columns = createAtBatDistributionModels(points, comparisons);
  const [selected, setSelected] = useState<{ pitch: number; score: number } | null>(null);
  const chosen = columns.find(column => column.pitch === selected?.pitch);
  const detail = chosen?.segments.find(segment => segment.score === selected?.score);
  const pendingGroups = ([
    { status: 'loading', label: 'Loading' },
    { status: 'empty', label: 'No peers' },
    { status: 'unavailable', label: 'Unavailable' },
  ] as const).map(group => ({
    label: group.label,
    pitches: columns.filter(column => column.status === group.status).map(column => 'AB' + column.pitch),
  })).filter(group => group.pitches.length > 0);
  return (
    <section className="score-distribution-panel" aria-label="At-bat score distribution">
      <h2>At-Bat Score Distribution</h2>
      <p>How other players scored on each at-bat, and where you landed.</p>
      <div className="score-dist-legend">
        {scoreValueLabels.map((score, index) => (
          <span key={score}><i className={'score-shade-' + index} aria-hidden="true" />{score}</span>
        ))}
        <span>● Your score</span>
      </div>
      <div className="score-ab-layout">
        <div className="score-ab-axis" aria-hidden="true">
          <span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span>
        </div>
        <div className="score-ab-columns">
          {columns.map(column => (
            <div className="score-ab-column" key={column.pitch}>
              <div className="score-ab-track">
                {column.status === 'ready' ? (
                  <>
                    <div className="score-ab-segments">
                      {column.segments.filter(s => s.count > 0).map(s => (
                        <button key={s.score} type="button"
                          className={'score-ab-segment score-shade-' + s.color}
                          style={{ height: s.percent + '%' }}
                          onClick={() => setSelected({ pitch: column.pitch, score: s.score })}
                          aria-label={'At-bat ' + column.pitch + ': ' + s.score + ' points, ' + s.count + ' peers, ' + s.percent.toFixed(1) + '%'}
                          title={s.score + ' points, ' + s.count + ' peers'}
                        />
                      ))}
                    </div>
                    {column.marker === null ? null : (
                      <span className="score-ab-marker" style={{ bottom: column.marker + '%' }} aria-hidden="true">{column.own}</span>
                    )}
                  </>
                ) : <span className="score-ab-empty" aria-hidden="true" />}
              </div>
              <strong className="score-ab-label">{'AB' + column.pitch}{column.status === 'ready' ? null : <span className="sr-only">{': ' + (column.status === 'loading' ? 'Loading comparison' : column.status === 'empty' ? 'No other results yet' : 'Comparison unavailable')}</span>}</strong>
              <span className="score-ab-avg"><span className="sr-only">{'At-bat ' + column.pitch + ' average '}</span>{column.average}<span className="sr-only">{column.average === '—' ? ' unavailable' : ' points'}</span></span>
              <span className={'score-ab-beat ' + (column.beat === '0%' ? 'score-negative' : column.beat === '—' ? '' : 'score-positive')}><span className="sr-only">{'At-bat ' + column.pitch + ' beat '}</span>{column.beat}<span className="sr-only">{column.beat === '—' ? ' unavailable' : ' of peers'}</span></span>
            </div>
          ))}
        </div>
      </div>
      <div className="score-ab-metric-labels"><span>AVG</span><span>BEAT</span></div>
      {pendingGroups.length === 0 ? null : (
        <p className="score-ab-status" role="status">
          {pendingGroups.map(group => group.label + ': ' + group.pitches.join(', ')).join(' · ')}
        </p>
      )}
      <p className="score-dist-detail" role="status" aria-live="polite">
        {detail && chosen ? 'AB' + chosen.pitch + ' · ' + detail.score + ' points · '
          + detail.count + ' result' + (detail.count === 1 ? '' : 's') + ' · '
          + detail.percent.toFixed(1) + '% of ' + chosen.count + ' peers'
          : 'Tap a segment to see its score, percentage and number of results.'}
      </p>
      <p className="score-dist-footnote">Each populated column totals 100%. BEAT counts strictly lower scores, not ties.</p>
    </section>
  );
}
