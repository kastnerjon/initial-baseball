# Daily Nine bottom Scoreboard — owner-selected visual polish

## Bounded scope contract

- **Goal:** make the deployed bottom Scoreboard match the owner's preferred left-hand reference more closely, without reopening product behavior.
- **Primary owner:** `apps/web` presentation JSX and scoped CSS.
- **In scope:** light bordered rounded card, stronger serif heading, Reveal answers aligned right within the same visual row, removal of redundant visible “N completed” label, denser regular-weight table text/quiet row rules, inset rounded pale-green TOTAL bar and clear separation of TOTAL from player-column dash. A native `details` disclosure remains during play and its count is still available to screen readers; it is not removed or redesigned.
- **Out of scope:** top `InningScoreboard` (next 1–9 tracker decision), scoring, statistics, result data, presentation math, player reveal logic, share text, active at-bat UX, archiving, Supabase, backend APIs, Classic results, and any dependency.
- **Architecture:** CSS selectors scoped to `.daily-nine-detail-card`/`.daily-nine-detail-table` and minimal existing `DailyNineDetailedScoreboard` markup. No new component, state, domain rule, or dependency. Continue using canonical engine-derived and comparison-projected values and the existing show/hide toggle.
- **Acceptance:** completed and expanded-during-play views display same-row title/switch at ordinary phone/desktop widths; 320px fallback avoids overlap; native disclosure and keyboard focus remain; scores, BEAT %, AVG, names, share safety, and all statuses are unchanged; TOTAL is a visually separated five-column aligned rounded strip; no regressions in Classic/top scoreboard. Run focused tests, exact-head CI, READY Preview, independent bounded review, post-merge push CI and production/runtime verification.
- **Stop conditions:** any underlying score/comparison change, new dependency, change to answer authority, state/persistence, or expansion into the top scoreboard.

## Documentation impact

Presentation direction reconciled in `docs/product/daily-inning-blueprint.md` and `docs/START-HERE.md`. This plan records the source screenshots' intentional comparison; the 1–9 progress banner remains a later separate owner-evaluated step. No changes to engine, API or database docs.
