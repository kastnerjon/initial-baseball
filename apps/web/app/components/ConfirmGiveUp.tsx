'use client';

import React, { useEffect, useState, type JSX } from 'react';

type ConfirmationAction = 'toggle' | 'confirm' | 'reset';

/** A second tap on the original button cancels; only a distinct confirmation commits. */
export function transitionGiveUpConfirmation(armed: boolean, action: ConfirmationAction):
  Readonly<{ armed: boolean; submit: boolean }> {
  if (action === 'toggle') return { armed: !armed, submit: false };
  if (action === 'confirm') return { armed: false, submit: armed };
  return { armed: false, submit: false };
}

export function ConfirmGiveUp({
  onConfirm, disabled, pending = false, className,
}: {
  onConfirm: () => void;
  disabled: boolean;
  pending?: boolean;
  className: string;
}): JSX.Element {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    // Another gameplay action, or a terminal request, invalidates confirmation.
    if (disabled) setArmed(false);
  }, [disabled]);

  const confirming = armed && !disabled;
  return (
    <div className="give-up-confirmation"
      role={confirming ? 'group' : undefined}
      aria-label={confirming ? 'Confirm give up' : undefined}
      onKeyDown={event => {
        if (confirming && event.key === 'Escape') setArmed(false);
      }}>
      <button type="button" className={className} disabled={disabled}
        aria-busy={pending}
        onClick={() => { setArmed(transitionGiveUpConfirmation(armed, 'toggle').armed); }}>
        {pending ? 'Revealing…' : confirming ? 'Cancel' : 'Give up'}
      </button>
      {confirming ? (
        <>
          <span className="give-up-confirmation-question" role="status">Are you sure?</span>
          <button type="button" className="give-up-confirmation-yes"
            onClick={() => {
              const next = transitionGiveUpConfirmation(armed, 'confirm');
              setArmed(next.armed);
              if (next.submit) onConfirm();
            }}>
            Yes, give up
          </button>
        </>
      ) : null}
    </div>
  );
}
