# Canonical Historical OBP and Career Rate Aggregation

Status: In progress  
Last updated: 2026-09-30

## Scope contract

- **Goal:** publish supported hitter OBP and OPS when a historical season has a structurally absent sacrifice-fly field, and derive career rates from career counting-stat totals.
- **Owning layer:** `packages/baseball-data` canonical rate enrichment.
- **In scope:** one shared pure batting-rate derivation module; season and career enrichment callers; regression/unit coverage; this data-contract documentation; generated runtime payload verification.
- **Out of scope:** source-data edits, player-specific overrides, UI formatting, pitcher fields, comparison behavior, archive beta behavior, and PR #289.
- **Acceptance checks:** Banks 1953 and career OBP/OPS become available; rates use unrounded aggregate components; unknown HBP and SF from seasons when the rule was active remain unavailable; zero remains a known value; strict canonical data generation and focused tests pass; blast-radius counts are recorded.
- **Stop conditions:** any apparent missing component that would require inventing a source value, any unrelated rate-stat defect, or a required change outside the baseball-data ownership boundary gets documented separately.

## Investigation evidence

- Ernie Banks maps to canonical ID `ibp_7da3b04033b9683c6a7c` and Lahman ID `bankser01`.
- His 1953 row has AB 35, H 11, BB 4, HBP 0, and blank SF. His career totals are AB 9,421, H 2,583, BB 763, HBP 70, SF 96, 2B 407, 3B 90, and HR 512.
- Before the fix, runtime enrichment produced career OBP/OPS `null` and season 1953 OBP/OPS `null`; the view model passes those nulls through as unavailable.
- Root cause: enrichment required every source row to contain every component before deriving each rate. One unavailable derived season rate consequently suppressed career OBP/OPS despite supported career totals.
- Current generated hitter universe (hitter and two-way career cards): 8,537 players; before the fix, 1,987 career OBP values and 1,994 OPS values were null. After the full rule-aware rebuild, 1,404 OBP and 1,412 OPS values remain null, so 583 hitter careers gained OBP and 582 gained OPS. Among substantial careers (AB >= 500 or at least five seasons), null OPS falls from 416 to 111. Remaining cases include rows with unknown SF while its rule applied and unknown HBP; those remain unavailable.
- The season rebuild increases published season OPS from 55,685 to 59,155. Of 5,127 blank-SF batting-source rows, 3,933 are from seasons where the rule did not apply (709 before 1908 and 3,224 in 1931–1938 or 1940–1953); 1,194 are from seasons where it applied and remain unknown. Of the pre-1908 blank-SF rows, 583 have all other OBP components and can support season OBP. HBP is independently missing in some historical rows and remains unavailable.

## Accepted calculation rules

- OBP is `(H + BB + HBP) / (AB + BB + HBP + SF)`.
- The SF rule did not apply before 1908, in 1931–1938, or in 1940–1953, so missing SF in those seasons is structurally inapplicable, not an inferred zero event count. A missing SF in seasons when the rule applied (1908–1930, 1939, and 1954 onward) remains unknown.
- Missing HBP remains unknown.
- Career OBP and SLG derive from career totals after validating the source components; do not average season ratios or use rounded display rates.
- OPS is the sum of the unrounded OBP and SLG values. BA and other established fields are unchanged.

## Verification checkpoint

Strict season/career enrichment and runtime generation pass with zero critical issues. The generated runtime payload publishes Banks career OBP `.3300`, SLG `.4995`, OPS `.8296`, plus 1953 OBP `.3846` and OPS `.9560`. Focused pure-logic tests pass. Complete after the fresh review and exact-head CI/Preview checks. PR #289 remains its own concern and is not a dependency of this change.
