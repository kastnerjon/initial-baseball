# Resolved player reveal — single-season career highs

## Scope contract

- **Goal:** Display already-derived canonical career regular-season high HR and pitching strikeout years when a player is fully resolved.
- **Owning layer:** `apps/web` resolved-reveal view model, legacy shape normalizer and responsive presentation.
- **In scope:** Carry optional `regularSeasonPeaks` from the existing #452 canonical reveal to the Web view model; validate optional saved-browser content; show HR for hitters, strikeouts for pitchers, both for two-way, known zeros when supported; add compact responsive styling and focused tests; update canonical blueprint and work queue.
- **Out of scope:** New calculations/data corrections, MLB API or external sources, active at-bat hints, clue ordering, scoring, answer/guess transport, issuer snapshots, Supabase, publication, Custom activation, league-leading claims or postseason records.
- **Acceptance checks:** Resolve-only model mapping tests, legacy and malformed saved reveal tests, visible hitter/pitcher/two-way/unknown rendering tests, focus/overflow mobile QA, repository CI, READY exact-head Preview and independent review.
- **Stop condition:** If the fields require a change to pre-resolution payloads or authorized reveal transport, split that new security decision into a separate PR.

## Boundary and compatibility

The server-owned canonical player reveal from #452 is available only on an authorized terminal resolution (correct guess, third strike or Give Up). The Web view model transports its optional career peaks without deriving baseball facts. Existing locally saved resolved revelations lack the field, and render the old table with no summary; invalid persisted values are discarded rather than invented. A verified zero remains zero. No hint requests or frozen issued clues change.

The compact two-column (or wrapped single-column on narrow screens) summary appears below career totals and above the existing season-by-season disclosure. The accessibility heading is `Single-season highs` and the fields have descriptive Home runs / Strikeouts names and a year.

## Documentation impact

- Adds this bounded plan.
- Updates `docs/product/daily-inning-blueprint.md` and `tasks/todo.md` with the resolved-only behavior.
