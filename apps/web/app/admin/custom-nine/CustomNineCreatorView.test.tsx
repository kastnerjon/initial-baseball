import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CustomNineCreatorView } from './CustomNineCreatorView';

describe('Custom Nine creator initial view', () => {
  it('stages an accessible 1–10 v2 creator without a public play link or hidden hints', () => {
    const html = renderToStaticMarkup(<CustomNineCreatorView mode="v2" />);
    expect(html).toContain('Create a Custom Lineup');
    expect(html).toContain('0 / 9 chosen');
    expect(html).toContain('Number of players');
    expect(html).toContain('<option value="10">10</option>');
    expect((html.match(/Search for a player…/g) ?? []).length).toBe(9);
    expect(html).toContain('Choose 1–10 different canonical players');
    expect(html).toContain('Swap to exchange');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Admin-only staging');
    expect(html).toContain('Legacy Custom Nine creator');
    expect(html).not.toContain('SECRET_SIGNED_TOKEN');
    expect(html).not.toContain('canonicalPlayerIds');
    expect(html).not.toContain('href="/custom/');
  });

  it("stages the 1/2/3 control only behind explicit source readiness", () => {
    const hidden = renderToStaticMarkup(<CustomNineCreatorView mode="v2" audience="public" />);
    expect(hidden).not.toContain("Strikes per out");
    const html = renderToStaticMarkup(
      <CustomNineCreatorView mode="v2" audience="public" variableStrikesAvailable />,
    );
    expect(html).toContain("Strikes per out");
    expect(html).toContain("The same strike limit applies to every at-bat");
    expect(html).toContain('value="1"');
    expect(html).toContain('value="2"');
    expect(html).toContain('value="3" selected=""');
    expect(html).not.toContain("canonicalPlayerIds");
    expect(renderToStaticMarkup(<CustomNineCreatorView />)).not.toContain("Strikes per out");
  });

  it('shows nine ordered empty places, search and disabled issuance without revealing answers', () => {
    const html = renderToStaticMarkup(<CustomNineCreatorView />);
    expect(html).toContain('Create a Custom Nine');
    expect(html).toContain('9 chosen');
    expect((html.match(/Choose a player/g) ?? []).length).toBe(9);
    expect(html).toContain('Find a player');
    expect(html).toContain('Issue immutable challenge');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Admin-only staging');
    expect(html).not.toContain('canonicalPlayerIds');
    expect(html).not.toContain('SECRET_SIGNED_TOKEN');
  });
});
