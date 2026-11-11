# Multiple official Daily Lineups and private Custom launch
Approved November 5, 2026. The windows below are estimates from a November 9 planning baseline. Release depends on verified behavior.

## November 10 delivery decision — supersedes earlier sequencing where inconsistent

**Goal:** Ship multiple independently competitive official Daily puzzles through the existing shared game, without duplicating gameplay or inventing a separate secondary scoring protocol. This is an approved engineering direction, **not production-release authorization**. All production migration and flag activation gates remain.

1. **Integrate the existing player journey bottom-up:** unified Archive (#606), chooser (#588), secondary navigation (#649/#651), with exact-head CI, independent review and READY Preview at each merge. Confirm primary archive links and remove duplicate archive presentation before declaring the Archive unified.
2. **Integrate essential editor workflow:** contextual player slot selection (#614) and existing frozen, revision-checked issuance. For the initial release, legacy primary remains Puzzle 1; optional renaming, reordering and primary reassignment are not launch blockers. Do not promise those controls until implemented and tested.
3. **Enable secondary competitive scoring at existing primary parity:** route admission through the authoritative released puzzle by exact immutable edition ID; validate ID/date/number/initials/ruleset, live-date eligibility and bounded delayed retries; isolate results, comparisons and leaderboard reads by puzzle ID and date. Reject future, unreleased, archived and cross-edition submissions. Preserve historical primary and Archive beta behavior. Named secondary leaderboard may remain disabled until stronger admission is ready.
4. **Do not require zero player overlap:** overlapping rosters are permitted; editor-facing spoiler warning may be added separately. Do not implement the browser-identity/cookie/Web Lock/ledger architecture proposed for #566 as a launch prerequisite. Record the superseding decision on #566 before closing or repurposing it.
5. **End-to-end hosted acceptance:** in isolated QA publish primary plus two secondary editions for one Pacific date; test issue retries, stale revisions, switching, resume, sharing, exact-ID score cohorts, Pacific rollover, hidden-answer exposure and physical Safari/Android. Verify actual production migration state and investigate historical primary records stuck in scheduled before enabling a unified archive.
6. **Separate high-priority security follow-up for ALL Daily editions:** existing stateless signed progression does not prove honest play; client-authored at-bats and hint counts permit fabricated results. Design server-authoritative score derivation with one proposed service-role-only `daily_attempt_states` table, revision compare-and-swap, server-issued attempt ID, signed attempt/revision claims, on-demand primary hints, replay-safe first-write-wins completion, and compatibility/rollout tests. The one-table design is a **proposal requiring independent threat-model and SQL review**, not a verified implementation. Rate limiting alone does not make scores trustworthy. Do not silently change historical scoring semantics.
7. **After multi-Daily:** resume account-backed private Custom Lineups, verified ownership, sharing and later discovery; do not activate Custom/Auth production features through a Daily release.

**Delivery discipline:** One player-visible journey per milestone; avoid repeated edits to large shared checkpoint/spec files on every small PR. Preserve exact-head CI, independent review, READY Preview, isolated Supabase QA, spoiler checks and explicit owner approval for production changes. Avoid ungrounded calendar commitments; report merged, staged, QA-verified and production-live states separately.

---

## What the editor publishes

On a Pacific game date the editor can add one or more nine-player puzzles, select every player and slot, name the puzzles and choose the primary. Default titles are Puzzle 1, Puzzle 2 and so on. Modern (2000 onward), 70s/80s/90s and Mixed are examples. No fixed set of editions or difficulty tiers. One Archive shows each occurrence as “Date – Puzzle title”. Use the same gameplay and completion UI for every edition. Future scoring changes must preserve previously issued rules and accepted results.

## Delivery order

1. **A1, private issuance.** Build a validated official publication candidate from editor-selected slots, a trusted opaque occurrence ID, and dated frozen clues. Add an additive service-only store, atomic issuance with revision checks, and admin-only scheduling. A retry must return the first-issued ID. Same-date editions may share an entire roster.
2. **A2, play by exact puzzle ID.** Separate browsing by date from playing by ID. Verify signed progression before selecting the puzzle. Cache by immutable identity. Serve each hint at reveal time; inspect bootstrap, resume, next batter and bulk hint routes for unrevealed values. Missing/future secondary puzzles fail closed.
3. **A3, independent scores.** Scope browser saves, locks, queued at-bats, first attempts, completion and leaderboard to each edition. Test relabeling results between identical rosters. Distinguish eligible delayed live submissions from archive practice. Keep all historical IDs, links, retries and anonymous eligibility.
4. **A4, first two editions.** Offer an edition choice, permanent share links and one date-grouped archive. Verify both directions of switching, mobile refresh, sharing and Pacific midnight. Target weeks 1–2, roughly 6–10 engineering days before review/device waits.
5. **B, publisher workflow.** Extend the existing admin calendar and lifecycle to add, order, name and schedule any number per date. Default a date to one primary and freeze its selection before play. Coordinate with the horizon inspection in #434. Target another week. Transition only future unscheduled dates after legacy parity.
6. **Accounts and private Custom.** In parallel with A, test real Google/Apple/email sign-in, draft recovery, verified ownership and cross-device creator exclusion. Target weeks 4–6 for private sharing after hosted QA. Guest drafts and guest recipient play; verified account to save, issue, share and manage. Support 1–10 players and immutable 1/2/3 strikes (default 3). My Creations lists the owner's games.
7. **Creator results and discovery.** Next, creator completion metrics, followed by public publishing/unpublishing, discovery and ratings. January planning target subject to private-launch evidence. Independent future scope includes synced history and H2H.

## Release and recovery

Keep the November 6 scheduled primary on its existing path. The legacy editorial date/number unique constraints and archive-beta numbered copies remain authoritative for their existing records. Never convert a published Daily into a Custom or a Custom into a Daily. Share pure content and baseball rules, keep ownership and competition admission separate.

For each material change require exact-commit CI, independent CodeRabbit and Codex review, READY Vercel Preview, then isolated hosted QA and physical iOS Safari/Android acceptance for user-visible changes. Rehearse only the selected Daily migrations on a production-shaped QA database. Roll back discovery and new starts first; retain compatible readers and delayed ingress for issued games. Production migration, feature enablement and launch require explicit release approval. No QA Custom schema promotion as part of Daily work.
