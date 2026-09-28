'use client';

import { useEffect, useId, useRef, type JSX, type MouseEvent } from 'react';
import type { DailyHowToContent } from '../dailyHowTo';

type DailyHowToDialogProps = {
  content: DailyHowToContent;
};

export function DailyHowToDialog({ content }: DailyHowToDialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    openDialog();
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="daily-how-to-trigger"
        onClick={openDialog}
      >
        How to play
      </button>

      <dialog
        ref={dialogRef}
        className="daily-how-to-dialog"
        aria-labelledby={titleId}
        onClose={() => triggerRef.current?.focus()}
        onClick={handleBackdropClick}
      >
        <div className="daily-how-to-dialog-panel">
          <div className="daily-how-to-dialog-header">
            <h2 id={titleId}>{content.title}</h2>
            <button
              type="button"
              className="daily-how-to-dialog-close"
              aria-label="Close How to play"
              onClick={closeDialog}
            >
              ×
            </button>
          </div>

          <p className="daily-how-to-intro">{content.intro}</p>
          <ol className="daily-how-to-steps">
            {content.steps.map(step => <li key={step}>{step}</li>)}
          </ol>
          <p className="daily-how-to-footer">{content.footer}</p>

          <button type="button" className="button-primary daily-how-to-done" onClick={closeDialog}>
            Got it
          </button>
        </div>
      </dialog>
    </>
  );

  function openDialog(): void {
    const dialog = dialogRef.current;
    if (dialog === null || dialog.open) return;
    dialog.showModal();
  }

  function closeDialog(): void {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>): void {
    if (event.target === event.currentTarget) closeDialog();
  }
}
