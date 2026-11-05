import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmGiveUp, transitionGiveUpConfirmation } from './ConfirmGiveUp';

describe('two-action Give Up safeguard', () => {
  it('never submits on the first tap or another tap in the same spot', () => {
    const first = transitionGiveUpConfirmation(false, 'toggle');
    expect(first).toEqual({ armed: true, submit: false });
    expect(transitionGiveUpConfirmation(first.armed, 'toggle'))
      .toEqual({ armed: false, submit: false });
    expect(transitionGiveUpConfirmation(false, 'confirm'))
      .toEqual({ armed: false, submit: false });
    expect(transitionGiveUpConfirmation(true, 'confirm'))
      .toEqual({ armed: false, submit: true });
  });

  it('cancels a pending confirmation on gameplay reset', () => {
    expect(transitionGiveUpConfirmation(true, 'reset'))
      .toEqual({ armed: false, submit: false });
  });

  it('shows only the initial safe action until explicitly armed', () => {
    const onConfirm = vi.fn();
    const html = renderToStaticMarkup(<ConfirmGiveUp
      className="button-give-up" disabled={false} onConfirm={onConfirm} />);
    expect(html).toContain('Give up</button>');
    expect(html).not.toContain('Yes, give up');
    expect(html).not.toContain('Are you sure?');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not offer confirmation while a gameplay request is pending', () => {
    const html = renderToStaticMarkup(<ConfirmGiveUp
      className="button-give-up" disabled pending onConfirm={() => undefined} />);
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Revealing…');
    expect(html).not.toContain('Yes, give up');
  });
});
