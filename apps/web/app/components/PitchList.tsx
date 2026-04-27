import type { JSX } from 'react';
import type { DailySharePitchLine } from '@initial-baseball/shared';

type PitchListProps = {
  pitchLines: DailySharePitchLine[];
};

export function PitchList({ pitchLines }: PitchListProps): JSX.Element {
  return (
    <ul className="pitch-list" aria-label="Pitch results">
      {pitchLines.map((line, index) => (
        <li key={`${line.initials}-${line.outcome}-${index}`} className="pitch-row">
          <span className="pitch-initials">{line.initials}</span>
          <strong>{line.outcome}</strong>
        </li>
      ))}
    </ul>
  );
}
