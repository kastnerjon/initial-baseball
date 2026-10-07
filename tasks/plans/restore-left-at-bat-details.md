# Restore left-aligned at-bat details

Status: CSS implementation complete; physical phone/tablet verification remains pending.

## Scope contract

- **Goal:** restore the hint content/reveal button and terminal per-at-bat comparison block to the left-aligned presentation that existed immediately before PR #324.
- **Owning layer:** `apps/web` CSS presentation.
- **In scope:** reverse only PR #324's centering declarations in `daily-game.css` and `daily-results.css`; reconcile the canonical handoff/product text and remaining device-QA todo with the owner's reversal.
- **Out of scope:** component markup, player reveal, guess/action rows, completed-game layout, scoring, comparison math/sample thresholds, result writes, persistence, archive behavior, dependencies, database changes, or broader visual redesign.
- **Acceptance checks:** the relevant selectors match their pre-#324 left-aligned declarations; existing hint/comparison render behavior remains intact; focused/full repository checks pass; exact-head CI and READY Preview pass; bounded fresh-eyes review finds no in-scope regression.
- **Stop conditions:** any JavaScript/component behavior change, new abstraction/dependency, or layout change beyond reversing the two centered regions.

## Architecture and effects

This is a presentation-only reversal in the existing web CSS owner. No domain behavior moves layers and no new dependency or abstraction is introduced. The safest implementation is to restore the exact pre-#324 CSS declarations rather than approximate the old appearance with new rules.

## Documentation impact

PR #324 recorded centering as intentional product presentation. This reversal must update the active handoff and product blueprint so future work does not reintroduce the rejected centering. The prior centering plan remains historical evidence and is marked superseded rather than rewritten as if it never happened.
