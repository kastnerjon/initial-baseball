// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PrimaryPlayerEditor from './PrimaryPlayerEditor';
let container, root;
const candidate = { canonicalPlayerId: 'private-id', displayName: 'Private Player', yearsPlayedDisplay: '2000–2010',
  requiresYearDisambiguation: false, playerType: 'Batter', primaryPosition: 'CF', teamsDisplay: 'ABC', recognizabilityRank: 1 };
const preview = { canonicalPlayerId: 'private-id', displayName: 'Private Player', initials: 'PP', playerType: 'Batter',
  firstSeason: 2000, lastSeason: 2010, position: 'CF', teams: 'ABC', careerLines: ['Career batting'], seasonCount: 10,
  hints: [{ hintLabel: 'Hint', hintValue: 'Value' }] };
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function type(input, value) { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }); }
async function submit(form) { await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); }
it('keeps searches and previews out of URLs and requires explicit replacement', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ results: [candidate], mayHaveMore: false }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ preview }) });
  vi.stubGlobal('fetch', fetcher);
  await act(async () => root.render(<PrimaryPlayerEditor puzzleDate="2030-01-01" slot={1} />));
  const input = container.querySelector('input[type="search"]'); await type(input, 'Private Player');
  await submit(input.closest('form'));
  expect(fetcher.mock.calls[0][0]).toBe('/admin/daily/players');
  expect(fetcher.mock.calls[0][1].body.toString()).toBe('q=Private+Player');
  expect(container.textContent).not.toContain('private-id');
  expect(container.textContent).not.toContain('Rank');
  expect(fetcher.mock.calls[0][1].referrerPolicy).toBe('no-referrer');
  const choose = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Private Player'));
  await act(async () => choose.click());
  expect(fetcher.mock.calls[1][1].body.toString()).toBe('playerId=private-id&puzzleDate=2030-01-01&slot=1');
  expect(location.href).not.toContain('Private'); expect(container.textContent).toContain('Exact game preview');
  const form = container.querySelector('form[action="/admin/daily/replace"]');
  expect(new FormData(form).get('canonicalPlayerId')).toBe('private-id');
  expect(fetcher).toHaveBeenCalledTimes(2);
  await type(input, 'Another');
  expect(container.querySelector('form[action="/admin/daily/replace"]')).toBeNull();
  expect(container.textContent).not.toContain('Private Player');
});
it('locks input while loading and rejects malformed results', async () => {
  let finish; vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { finish = resolve; })));
  await act(async () => root.render(<PrimaryPlayerEditor puzzleDate="2030-01-01" slot={1} />));
  const input = container.querySelector('input[type="search"]'); await type(input, 'Player');
  await submit(input.closest('form')); expect(input.disabled).toBe(true);
  await act(async () => finish({ ok: true, json: async () => ({ results: [null], mayHaveMore: false }) }));
  expect(input.disabled).toBe(false); expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.querySelector('form[action="/admin/daily/replace"]')).toBeNull();
});
