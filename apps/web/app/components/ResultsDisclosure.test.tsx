import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResultsDisclosure } from './ResultsDisclosure';

describe('ResultsDisclosure', () => {
  it('starts open and keeps its content mounted', () => {
    const html = renderToStaticMarkup(<ResultsDisclosure title="Summary"><p>Score</p></ResultsDisclosure>);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-controls=');
    expect(html).toContain('<button type="button"');
    expect(html).toContain('Score</p>');
  });
});
