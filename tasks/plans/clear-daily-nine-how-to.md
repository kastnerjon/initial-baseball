# Clarify Daily Nine How to Play

Status: Implementation drafted for review.

## Scope contract

- **Goal:** ship the owner's approved clearer points-v4 How to Play copy, including an accessible points/outcome table and strike explanation.
- **Owning layer:** `apps/web` ruleset-aware help copy and native dialog presentation.
- **In scope:** points-v4 copy authority in `dailyHowTo.ts`; conditional table/strike section in the existing dialog; compact responsive table styling in existing web CSS; focused copy/markup tests; canonical product and handoff docs.
- **Out of scope:** points-v3 or Classic rules/copy, scoring engine, persistence, API, browser gameplay, automatic modal display, close/reopen/focus behavior, new dependencies or design changes outside the modal.
- **Acceptance:** five rows mapping No hints to HR 4, 1 hint to 3B 3, 2 hints to 2B 2, 3 hints to 1B 1, 4 hints to BB 0.5; incorrect guesses called strikes; first two free; third/Give Up zero; max 36 across 9. Semantic headers/caption and compact mobile rendering; existing v3/Classic lists unchanged. Exact-head CI, READY Preview, bounded fresh-eyes review, post-merge production/route/log verification.
- **Stop conditions:** any need for game-rule, data-contract, auth or persistence changes; any new dialog behavior or abstraction not required for the copy.

## Architecture and second-order effects

The existing web helper is the sole copy authority keyed to the actual ruleset. Optional v4 display fields extend this presentation model only; no domain rule is introduced and no scoring math is duplicated. Rendering remains in the existing native dialog and preserves the reopen/focus and page-entry behavior. Table cells wrap as needed; dialog keeps its existing viewport-height scrolling. Historical v3 and Classic sessions take the unchanged ordered-list branch.

## Documentation impact

Update the living product blueprint and active handoff. No server, data, architecture or API docs change.
