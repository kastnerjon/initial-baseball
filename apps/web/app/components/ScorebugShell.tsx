import type { JSX } from 'react';

type ScorebugShellProps = {
  left: JSX.Element;
  middle: JSX.Element;
  right: JSX.Element;
};

export function ScorebugShell({ left, middle, right }: ScorebugShellProps): JSX.Element {
  return (
    <section className="scorebug-shell" aria-label="Scorebug">
      <div className="scorebug-block scorebug-left">{left}</div>
      <div className="scorebug-block scorebug-middle">{middle}</div>
      <div className="scorebug-block scorebug-right">{right}</div>
    </section>
  );
}
