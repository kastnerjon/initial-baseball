import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DailyFiveDraftWorkbench } from './DailyFiveDraftWorkbench';

describe('future Daily Five admin editor shell', () => {
  it('renders exactly five ordered slots, a target date and a disabled save button', () => {
    const html = renderToStaticMarkup(<DailyFiveDraftWorkbench />);
    expect(html.match(/Unselected/g)).toHaveLength(5);
    expect(html).toContain('type="date"');
    expect(html).toContain('Search by name');
    expect(html).toContain('Save five-player draft');
    expect(html).toMatch(/<button type="button" disabled="">Save five-player draft/);
    expect(html).not.toContain('/admin/daily/lifecycle');
  });

  it('stages a guarded Save control only when an operator opts in', () => {
    const html = renderToStaticMarkup(<DailyFiveDraftWorkbench writesEnabled />);
    expect(html).toContain('Save five-player draft');
    expect(html).not.toContain('unavailable during staging');
    // The incomplete draft still cannot submit.
    expect(html).toMatch(/<button type="button" disabled="">Save five-player draft/);
  });
});
