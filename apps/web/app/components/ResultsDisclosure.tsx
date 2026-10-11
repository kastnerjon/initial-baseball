'use client';
import React, { useId, useState, type JSX } from 'react';

/** Default-open result panel. Keep content mounted when folded. */
export function ResultsDisclosure({ title, children }: { title: string; children: JSX.Element }): JSX.Element {
  const [expanded, setExpanded] = useState(true);
  const id = useId();
  return (
    <section className="your-nine results-disclosure" aria-label={title}>
      <h2 className="your-nine-header-heading">
        <button type="button" className="your-nine-header"
          aria-expanded={expanded} aria-controls={id}
          onClick={() => setExpanded(current => !current)}>
          <span className="your-nine-heading">{title}</span>
          <span className="your-nine-disclosure-icon" aria-hidden="true">{expanded ? '−' : '+'}</span>
        </button>
      </h2>
      <div id={id} className="your-nine-body results-disclosure-body" hidden={!expanded}>{children}</div>
    </section>
  );
}
