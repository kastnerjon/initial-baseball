# Near-term product sequence — search, Daily polish, archive beta

Status: approved implementation sequence; Daily polish through scoreboard AVG preload is complete through September 28, 2026.

## Goal

Continue from the production-verified points-v4 cutover with small, reversible PRs. The bounded visual Daily polish sequence is complete. Next, preload the nine scoreboard comparison averages from game initialization, then begin exercising the already-built archive foundation with real lineups as **pre-launch archive test data**. The eventual permanent Daily #1 and launch epoch remain deliberately undecided.

## Operating contract

- Start every PR from verified live `main`; do not trust this document as a substitute for GitHub/Vercel/Supabase state.
- One bounded owning concern per PR and preferably one commit.
- Write the scope contract before implementation.
- Preserve modular/domain boundaries and consider second- and third-order effects before coding.
- Add focused regression tests; do not weaken existing QA gates.
- Fresh-eye architecture/code review before merge, then make only in-scope corrections.
- Reconcile canonical docs in every PR and use the exact `## Documentation impact` PR heading.
- Verify exact-head CI and Vercel Preview; verify Supabase only when the change touches hosted persistence or its assumptions.
- Merge only when clean. After merge verify exact `main`, push CI, production deployment/logs where applicable, and open-PR state.
- Record unrelated defects separately rather than expanding the active PR.

## Settled product decisions

### Search relevance

The production API reproduces the reported problem: a query such as `pedro ma` can rank Pedro Alvarez/Avila/etc. ahead of Pedro Martinez. The shared engine search ranker is the owning layer; the dropdown merely renders returned order.

Preserve normalization, aliases, canonical player IDs, duplicate-name/year disambiguation, deterministic limits, and useful single-token search. Improve ranking rather than adding UI-side sorting, fuzzy-search dependencies, or a new search service. Multi-token visible-name prefix matches should outrank weaker hidden-name/alias matches.

Implementation checkpoint: complete in the shared engine. Ranking now prefers visible display-name matches over hidden full-name/alias matches while retaining the existing normalization, ordered token-prefix matching, alias search, canonical duplicate/year behavior, deterministic ordering, and result limit.

### Daily Nine inning scoreboard

Replace the current green status banner above the active at-bat with a compact 1–9 scoreboard.

- Columns 1–9 show the corresponding public initials.
- A `YOU` row shows resolved personal points; unresolved/current/future slots use a stable empty/dash state.
- An `AVG` row shows the existing exact-slot comparison average when displayable; unavailable/withheld values remain `—`.
- The active at-bat column is visually highlighted.
- A rightmost `TOTAL`/points column shows cumulative personal points. TOTAL AVG remains `—` during play and, once all nine at-bats are resolved, uses the existing authoritative completed-game average. Per-AB averages are never summed; no new backend aggregation was added.
- Remove the banner's `At bat X of 9`, `Points possible this AB`, `Points so far`, and `Strikeouts` metrics rather than duplicating them.
- Do **not** add a replacement maximum-points indicator.
- This is presentation only: consume existing engine/game/comparison state; do not move scoring, persistence, or comparison rules into React.
- The renderer is a pure presentation component intended for reuse by current and archived Daily Nine rather than forking archive presentation. The resolved-at-bat comparison and collapsible scorecard remain intentionally because they carry richer result context and player-answer detail; removing either is a separate UX decision.
- Treat narrow/mobile layout, accessible table semantics/labels, loading/withheld AVG states, half-point values, restore, and active-column transitions as acceptance cases.

### Archive beta before permanent launch

The owner wants to start using the archive with real lineups for several weeks before choosing the true permanent start.

These issued test puzzles are **pre-launch archive test data**, not the commitment to Permanent Daily #1. The eventual launch may reset the archive series/data and restart numbering. Do not configure the permanent launch epoch merely to begin testing.

Temporary status does not weaken puzzle immutability: once a test puzzle is issued, its lineup/clues remain frozen and normal archive identity/save/result isolation applies. Reset happens at the series/test-data boundary, not by mutating an issued puzzle in place.

Before writing test rows, inspect whether using the existing `permanent-v1` identity for knowingly disposable data would make the later reset unsafe or semantically misleading. Prefer an explicit beta/test series if it can be introduced without needless framework work. Do not fabricate production rows until that identity/reset contract is settled.

New archive attempts use the then-current public ruleset (currently points-v4); an already-started attempt retains its exact ruleset. Comparison populations remain exact puzzle + exact ruleset. Do not import or reinterpret current beta Daily result populations.

## Planned PR sequence

1. **Search ranking — complete.** Regression coverage now locks the reported multi-token case and the shared-engine ranker prefers visible display-name matches over hidden full-name/alias matches. No dropdown redesign or API-contract change.
2. **Daily Nine inning scoreboard — complete.** Replaced the points-mode status banner with the reusable 1–9 initials / YOU / AVG / TOTAL table. TOTAL AVG uses completed-game comparison data only after completion; no backend aggregation, scoring, or persistence changes.
3. **Terminal result callout — complete.** Center the resolved Daily Nine callout as canonical baseball outcome plus authoritative awarded points, with no scoring or persistence change.
4. **Personal scorecard Outcome column — complete.** Show recorded canonical outcomes alongside SCORE and AVG in the private in-app scorecard without inferring outcomes from points; keep copied share output spoiler-safe and outcome-free.
5. **Season-table mobile sticky-column polish — complete.** At narrow widths keep only Season horizontally sticky while Team scrolls with stats; preserve the sticky header row, table overflow, and existing desktop two-column sticky presentation.
6. **Scoreboard AVG preload — complete.** After saved-game hydration, request all nine exact-slot comparison averages through the existing bounded per-pitch cache and retain/display successful values in the scoreboard throughout play, including before an at-bat is reached. Loading uses `…`; unavailable/withheld values stay `—`; terminal YOU/AVG reuses the same cached slot instead of issuing a duplicate active-slot read. Comparison I/O remains nonblocking, exact puzzle + ruleset + pitch identity is preserved, and completed TOTAL AVG continues to use the separate authoritative completed-game average rather than per-AB arithmetic.
7. **Archive-beta identity/reset contract.** Decide and encode the narrow pre-launch series/reset boundary after inspecting the existing `permanent-v1` contracts. No archive UI or puzzle issuance in this PR.
8. **Archive-beta issuance.** Freeze real authoritative lineups/clues into the test archive through the existing immutable schema-v2 issuance path. Verify exact read-back/materialization; no public routes yet.
9. **Recurring issuance.** Attach idempotent issuance to the narrowest authoritative publication lifecycle seam if appropriate; do not invent a cron or fabricate missing lineups without evidence.
10. **Archive routes/navigation.** Expose only actually issued test puzzles; missing/unissued puzzles fail closed. Reuse the existing server archive runtime.
11. **Archive gameplay.** Reuse Daily Nine gameplay under exact archive puzzle/ruleset identity; prove current Daily, separate archive puzzles, versions, tabs, restore, and reset cannot overwrite one another.
12. **Archive results/comparisons.** Route archived result delivery and YOU/AVG/completed comparison by exact archive puzzle + exact ruleset; never merge same-date beta Daily populations.
13. **Local archive history.** Browser/device-only completion and score history keyed by immutable puzzle + game/ruleset. Choose first-result/replay policy explicitly before implementation.
14. **Archive sharing/polish/QA.** Spoiler-safe permanent/test archive identity in share output as appropriate, navigation polish, failure states, physical mobile/browser QA.
15. **Later permanent-launch cutover.** After the beta archive has been exercised, explicitly choose the surviving public game/rules, permanent launch date and true Daily #1; retire/reset pre-launch archive test data through the settled reset boundary and preserve the new permanent series thereafter.

## Stop conditions

Split work rather than expanding the active PR if implementation reveals a schema migration, a new primary owning layer, a result-identity change, or a materially different product decision. In particular, do not let the scoreboard PR change comparison semantics, and do not let archive route work silently decide permanent launch identity.
