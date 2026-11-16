// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PrivatePlayerReplacement from './PrivatePlayerReplacement';

let container;
let root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it('searches by POST and prefills an in-page selection without putting player data in URLs', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    results: [{ canonicalPlayerId: 'private-player-id', displayName: 'Private Player',
      primaryPosition: 'CF', yearsPlayedDisplay: '2000–2010',
      requiresYearDisambiguation: false, revealReady: true }], hasMore: false,
  }) });
  vi.stubGlobal('fetch', fetcher);
  await act(async () => root.render(<PrivatePlayerReplacement
    occurrenceId="907f33db-c38f-43c3-8e6b-a3aaf19bbd08" revision={3}
    selections={[{ slot: 1, canonicalPlayerId: 'original', displayName: 'Original' }]} />));
  const input = container.querySelector('#private-player-query');
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Private Player');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const searchForm = input.closest('form');
  await act(async () => searchForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe('/admin/daily/editions/players/search');
  expect(options.method).toBe('POST');
  expect(options.referrerPolicy).toBe('no-referrer');
  expect(options.cache).toBe('no-store');
  expect(options.body.toString()).toBe('q=Private+Player');
  expect(location.href).not.toContain('Private');
  const select = [...container.querySelectorAll('button')].find(button => button.textContent === 'Use this player');
  await act(async () => select.click());
  expect(container.querySelector('#draft-replace-player').value).toBe('private-player-id');
  expect(container.querySelector('input[name="expectedRevision"]').value).toBe('3');
  const slot = container.querySelector('#draft-replace-slot');
  await act(async () => {
    slot.value = '1';
    slot.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const replacement = container.querySelector('form[action="/admin/daily/editions/review/replace"]');
  const body = new FormData(replacement);
  expect(body.get('slot')).toBe('1');
  expect(body.get('canonicalPlayerId')).toBe('private-player-id');
  expect(body.get('expectedRevision')).toBe('3');
  expect(container.innerHTML).not.toContain('canonicalPlayerId=private-player-id');
});

it('does not offer selection for unready candidates and fails closed on malformed replies', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({
      results: [{ canonicalPlayerId: 'unready', displayName: 'Unready', primaryPosition: 'CF',
        yearsPlayedDisplay: '', requiresYearDisambiguation: false, revealReady: false }], hasMore: false,
    }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [null], hasMore: false }) });
  vi.stubGlobal('fetch', fetcher);
  await act(async () => root.render(<PrivatePlayerReplacement occurrenceId="fixture" revision={3} selections={[]} />));
  const input = container.querySelector('#private-player-query');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Player');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const form = input.closest('form');
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(container.textContent).toContain('Clue material unavailable');
  expect(container.textContent).not.toContain('Use this player');
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(container.querySelector('[role="alert"]').textContent).toContain('temporarily unavailable');
  expect(container.querySelector('#draft-replace-player').value).toBe('');
});
