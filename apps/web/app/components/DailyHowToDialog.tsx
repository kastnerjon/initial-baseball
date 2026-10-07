'use client';

import React, { useEffect, useId, useRef, type JSX, type MouseEvent } from 'react';
import type { DailyHowToContent } from '../dailyHowTo';

type DailyHowToDialogProps = {
  content: DailyHowToContent;
};

type ModalDialogControl = {
  open: boolean;
  showModal(): void;
  close(): void;
};

type FocusControl = {
  focus(): void;
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
        onClose={focusTrigger}
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
          {content.lead === undefined ? null : (
            <p className="daily-how-to-lead"><strong>{content.lead}</strong></p>
          )}
          {content.scoringRows === undefined ? (
            <ol className="daily-how-to-steps">
              {content.steps.map(step => <li key={step}>{step}</li>)}
            </ol>
          ) : (
            <table className="daily-how-to-scoring-table">
              <caption className="sr-only">Points awarded for a correct guess</caption>
              <thead>
                <tr>
                  <th scope="col">When you guess correctly</th>
                  <th scope="col">Result</th>
                  <th scope="col">Points</th>
                </tr>
              </thead>
              <tbody>
                {content.scoringRows.map(row => (
                  <tr key={row.when}>
                    <td>{row.when}</td>
                    <td>{row.result}</td>
                    <td>{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {content.strikes === undefined ? null : (
            <section className="daily-how-to-strikes" aria-label="Strike rules">
              <h3>{content.strikes.heading}</h3>
              <ul>
                {content.strikes.rules.map(rule => <li key={rule}>{rule}</li>)}
              </ul>
            </section>
          )}
          <p className="daily-how-to-footer">
            {content.footerLabel === undefined ? null : <><strong>{content.footerLabel}</strong>{' '}</>}
            {content.footer}
          </p>

          <button type="button" className="button-primary daily-how-to-done" onClick={closeDialog}>
            Got it
          </button>
        </div>
      </dialog>
    </>
  );

  function openDialog(): void {
    const dialog = dialogRef.current as unknown as ModalDialogControl | null;
    if (dialog === null || dialog.open) return;
    dialog.showModal();
  }

  function closeDialog(): void {
    const dialog = dialogRef.current as unknown as ModalDialogControl | null;
    if (dialog?.open) dialog.close();
  }

  function focusTrigger(): void {
    const trigger = triggerRef.current as unknown as FocusControl | null;
    trigger?.focus();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>): void {
    if (event.target === event.currentTarget) closeDialog();
  }
}
