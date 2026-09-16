import type { JSX } from 'react';

type ScorebugShellProps = {
  left: JSX.Element;
  middle: JSX.Element;
  right: JSX.Element;
  layout?: 'standard' | 'four-up';
};

export function ScorebugShell({
  left,
  middle,
  right,
  layout = 'standard',
}: ScorebugShellProps): JSX.Element {
  return (
    <section
      className={layout === 'four-up' ? 'scorebug-shell scorebug-shell-four-up' : 'scorebug-shell'}
      aria-label="Scorebug"
    >
      <div className="scorebug-block scorebug-left">{left}</div>
      <div className="scorebug-block scorebug-middle">{middle}</div>
      <div className="scorebug-block scorebug-right">{right}</div>
    </section>
  );
}
