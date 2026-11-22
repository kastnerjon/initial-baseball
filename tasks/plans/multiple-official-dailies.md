# Multiple official Daily Lineups and private Custom launch
Approved November 5, 2026. The windows below are estimates from a November 9 planning baseline. Release depends on verified behavior.

## November 19 decision on scored archive play

Players can start or resume any released official edition from its archive entry. Record the score once against that edition regardless of the play date. The Pacific release date controls first availability. Returning players with the same browser credential can resume their signed progress and revisit their completed scorecard. Future editions remain closed.

## November 12 superseding decision: production gameplay parity

Secondary official editions are additional puzzles in the existing Daily Nine game, not a second gameplay architecture. Custom Lineups change authorship and authorization, but friend play inherits the same interactions whenever its rules match. Preserve the primary game's server-authorized four-hint bundle plus signed checkpoints for the active batter, with immediate local hint taps. Verify no canonical answer or future-batter clue leakage. The owner accepts current-batter hint inspectability in casual play; retain exact-edition save identity and fail-closed competitive score admission (#657), separate from broader #656.

Before source merge of #588, replace its per-hint server round-trip with the existing current-batter bundle contract, then verify both modes' interaction timing, guess/Give Up, persistence and full scorecard on hosted iPhone/Android. A slower alternate design requires explicit owner signoff. This decision supersedes the old A2 per-hint fetch instruction below; no production flags or competition activation are approved.

## What the editor publishes

On a Pacific game date the editor can add one or more nine-player puzzles, select every player and slot, name the puzzles and choose the primary. Default titles are Puzzle 1, Puzzle 2 and so on. Modern (2000 onward), 70s/80s/90s and Mixed are examples. No fixed set of editions or difficulty tiers. One Archive shows each occurrence as “Date – Puzzle title”. Use the same gameplay and completion UI for every edition. Future scoring changes must preserve previously issued rules and accepted results.

## Delivery order

1. **A1, private issuance.** Build a validated official publication candidate from editor-selected slots, a trusted opaque occurrence ID, and dated frozen clues. Add an additive service-only store, atomic issuance with revision checks, and admin-only scheduling. A retry must return the first-issued ID. Same-date editions may share an entire roster.
2. **A2, play by exact puzzle ID.** Separate browsing by date from playing by ID. Verify signed progression before selecting the puzzle. Cache by immutable identity. Supply only the current batter's server-authorized four-hint bundle and signed checkpoints at bootstrap/advance/resume; hint taps are local and immediate. Inspect transport boundaries for early answers and future-batter clues. Missing/future secondary puzzles fail closed.
3. **A3, independent scores.** Scope browser saves, locks, queued at-bats, first attempts, completion and leaderboard to each edition. Test relabeling results between identical rosters. Apply the same scoring rules to first plays and resumes in the archive. Keep all historical IDs, links, retries and anonymous eligibility.
4. **A4, first two editions.** Offer an edition choice, permanent share links and one date-grouped archive. Verify both directions of switching, mobile refresh, sharing and Pacific midnight. Target weeks 1–2, roughly 6–10 engineering days before review/device waits.
5. **B, publisher workflow.** Extend the existing admin calendar and lifecycle to add, order, name and schedule any number per date. Default a date to one primary and freeze its selection before play. Coordinate with the horizon inspection in #434. Target another week. Transition only future unscheduled dates after legacy parity.
6. **Accounts and private Custom.** In parallel with A, test real Google/Apple/email sign-in, draft recovery, verified ownership and cross-device creator exclusion. Target weeks 4–6 for private sharing after hosted QA. Guest drafts and guest recipient play; verified account to save, issue, share and manage. Support 1–10 players and immutable 1/2/3 strikes (default 3). My Creations lists the owner's games.
7. **Creator results and discovery.** Next, creator completion metrics, followed by public publishing/unpublishing, discovery and ratings. January planning target subject to private-launch evidence. Independent future scope includes synced history and H2H.

## Release and recovery

**Controlled scored-production activation (source-staged; OFF until separate approval):** The protected Preview QA switch is not production admission. The server must use the same exact scored eligibility predicate for Archive labels, today's edition chooser, shared exact-edition Daily page and competitive POSTs. QA requires `VERCEL_ENV=preview` with its existing explicit QA flag; production requires `VERCEL_ENV=production`, all shared practice/private runtime/transport flags, `OFFICIAL_DAILY_EDITION_COMPETITIVE_HTTP_ENABLED=true`, and a **separate** exact `OFFICIAL_DAILY_COMPETITIVE_PRODUCTION_ENABLED=true`. No missing, preview-only or noncanonical setting may enable production scoring. The production switch and server-only signing secret must **not** be added/changed until a later explicit activation decision. Keep private SQL service-only. The November 21–22 production schema install is additive and empty; reconcile generated installed migration version IDs before future migration pushes.

Keep the November 6 scheduled primary on its existing path. The legacy editorial date/number unique constraints and archive-beta numbered copies remain authoritative for their existing records. Never convert a published Daily into a Custom or a Custom into a Daily. Share pure content and baseball rules, keep ownership and competition admission separate.

For each material change require exact-commit CI, independent CodeRabbit and Codex review, READY Vercel Preview, then isolated hosted QA and physical iOS Safari/Android acceptance for user-visible changes. Rehearse only the selected Daily migrations on a production-shaped QA database. Roll back discovery and new starts first; retain compatible readers and delayed ingress for issued games. Production migration, feature enablement and launch require explicit release approval. No QA Custom schema promotion as part of Daily work.

## November 16 source candidate: authenticated transcript consumption (#657)

The WIP signs exact edition/date/ruleset, server-issued attempt ID, live-start
time, inner progression and ordered server-observed terminal facts. Its
server-only consumer accepts the proof and expected edition ID, not caller score
facts. It requires an explicit trusted maximum attempt age, rejects future or
incorrect-date starts, resolves released immutable content and validates the
entire transcript before writes.

The candidate reuses existing repositories: insert-or-return the winner for each
terminal fact in pitch order, stop at the first mismatch, then insert the
engine-derived completion under a deterministic edition/attempt ID. Immutable
prefix rows survive failed requests and are reconciled by retries. This is
per-row atomic admission, not an all-or-nothing transaction. Safety depends on
immutable repository winners and every secondary writer using this boundary.
Existing public routes remain fail-closed; this candidate has no route imports.

It does not reserve the first browser start, prevent token forks or repeated
bootstrap, identify a unique human, or replace #656. Production admission
architecture remains unapproved. Independent security/SQL review, actual
database races/recovery, concrete publication/runtime/HTTP wiring,
first-start policy, retry-window/key-rotation decisions and all release gates
remain required. No schema or feature is activated.
