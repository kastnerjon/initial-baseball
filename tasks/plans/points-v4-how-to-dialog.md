# Points-v4 H5a ruleset-aware How to play dialog

Status: implementation scope; pre-cutover UI only  
Date: 2026-09-27

## Goal

Replace the existing header `<details>` instructions with an accessible, reopenable “How to play” modal that opens on every game-page entry/reload and renders copy from the exact active ruleset.

This is H5a, not the v4 scoring cutover. `CURRENT_DAILY_RULESET_VERSION` remains `points-v3` in this PR.

## Release timing

At implementation time it is still September 27 in Pacific time. Switching the public default before the next Pacific puzzle boundary would create a same-puzzle mid-day v3/v4 split. The September 24 roadmap explicitly calls out avoiding incompatible mid-day clue/rule experiences.

Therefore:
- H5a may deploy immediately because it is ruleset-aware and preserves the current v3 default;
- H5b remains a separate release-safe checkpoint for the default switch at the September 28 Pacific puzzle boundary or later.

## Design

### One copy authority

Add a pure `getDailyHowToContent` helper for the web-exposed rulesets:
- points-v3;
- points-v4;
- Classic Inning.

The copy must describe the exact active scoring/completion rules rather than infer from “current” defaults.

V3:
- initials-first guessing;
- up to four hints;
- starts at 7 points;
- each revealed hint and wrong guess costs 1;
- third wrong guess / Give Up scores 0;
- all nine ABs, max 63.

V4:
- initials-first guessing;
- scoring by reveal depth: 4 / 3 / 2 / 1 / 0.5;
- wrong guesses one and two do not deduct;
- third wrong guess / Give Up is K and scores 0;
- all nine ABs, max 36.

Classic:
- third wrong guess / Give Up records an out;
- hits/walks advance runners;
- inning ends at three outs or after the ninth AB.

Do not duplicate these formulas inside the dialog component.

### Dialog behavior

Use the native HTML `<dialog>` element rather than creating a custom focus-trap implementation.

On every component mount:
- call `showModal()`;
- do not read/write local storage or cookies;
- do not maintain a dismissal flag.

The header keeps a normal “How to play” button that can reopen it.

Accessibility/interaction:
- `aria-labelledby` references a visible heading;
- native modal semantics provide focus containment and Escape dismissal;
- explicit close controls are buttons;
- closing returns focus to the reopen button;
- backdrop click may close;
- mobile layout fits the viewport;
- no game hydration/reset API is coupled to dialog state.

### Gameplay independence

The dialog is a sibling of `DailyInningGame`. Opening or closing it must not:
- create/reset gameplay state;
- alter save/journal/outbox identities;
- pause or restart save hydration;
- change comparison/result delivery;
- select a ruleset.

The server bootstrap remains authoritative for the ruleset and the dialog receives only display content derived from that exact value.

## In scope

- pure exact-ruleset How-to content helper;
- client dialog component;
- replace the existing header details disclosure;
- responsive/accessibility styling;
- focused copy regression tests for v3/v4/Classic;
- Preview browser verification of initial-open, Escape/close, reopen and responsive behavior;
- documentation reconciliation for H5a.

## Out of scope

- changing `CURRENT_DAILY_RULESET_VERSION`;
- date-aware/scheduled default switching;
- scoring, result, comparison, persistence or Supabase changes;
- archive routes/navigation;
- removal of the local Reset control;
- permanent launch date/epoch selection.

## Acceptance checks

1. Current v3 page opens the modal automatically on each fresh page entry/reload.
2. Current v3 copy says 7-point start / deductions / 63 max.
3. A v4 content regression test proves 4/3/2/1/0.5/0, no first-two-wrong deduction, 36 max.
4. Classic copy remains mode-appropriate.
5. Escape and explicit close dismiss the modal.
6. Header “How to play” reopens the same modal.
7. Closing restores focus to the reopen control.
8. No dismissal preference is persisted.
9. Existing Daily gameplay still hydrates independently behind the modal.
10. `CURRENT_DAILY_RULESET_VERSION` remains v3 after merge.
11. No Supabase migration/provider/data mutation.
12. Exact-head CI and Vercel Preview pass before merge.

## H5b handoff

After H5a is merged and production-verified, H5b is the separate cutover PR:
- re-verify live main and Pacific date boundary;
- run the documented v4 readiness suite, including current-save isolation, result retry/failure, comparison identity/failure, concurrent-tab/takeover invariants and archive exact-version tests;
- switch `CURRENT_DAILY_RULESET_VERSION` from v3 to v4 last;
- update default/max-score assumptions and canonical docs;
- verify Preview/live copy becomes 4/3/2/1/0.5/0 and 36 max;
- verify v3 persisted populations remain untouched and v3/v4 comparisons stay separate.

## Documentation impact

Update START-HERE, product/engine/API handoffs, September 24 roadmap and todo so H5a is complete while H5b remains the final public scoring switch.
