import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getDailyHowToContent } from '../dailyHowTo';
import { POINTS_V3_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { DailyHowToDialog } from './DailyHowToDialog';

describe('DailyHowToDialog structure', () => {
  it('renders an accessible native dialog plus persistent reopen and close controls', () => {
    const html = renderToStaticMarkup(
      <DailyHowToDialog content={getDailyHowToContent(POINTS_V3_DAILY_RULESET_VERSION)} />,
    );

    expect(html).toContain('<dialog');
    expect(html).toContain('aria-labelledby=');
    expect(html).toContain('>How to play</button>');
    expect(html).toContain('aria-label="Close How to play"');
    expect(html).toContain('How to play Daily Nine');
    expect(html).toContain('>Got it</button>');
  });
});
