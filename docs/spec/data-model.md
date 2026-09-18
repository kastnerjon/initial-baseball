# Data Model Spec

Status: Current persistence contract and approved next entities  
Last updated: 2026-09-17

## Ownership

| Concern | Authority |
|---|---|
| Canonical identity, aliases, teams, seasons, career facts, enrichment, hints, and reveals | Versioned artifacts and source pipeline in `packages/baseball-data` |
| Outcomes, scoring, completion, runner rules, and completed-result validation/derivation | `packages/engine` |
| Lineup profiles/recipes, generation, validation, lifecycle, completed-result orchestration, and provider-neutral repository contracts | `packages/daily` |
| Anonymous in-progress visible state | Browser state plus opaque signed progression authorization |
| Editorial future/past puzzle records | `public.daily_editorial_puzzles` through `DailyPuzzleRepository` |
| Current completed-result provider storage | `public.daily_completed_results` through the web Supabase adapter behind `DailyCompletedResultRepository` |
| Future permanent archive identity and personal archive history | Separate migrations/adapters/local schemas described below |
| Future gameplay profiles and saved recipes | Separate provider-neutral contracts and migrations, not legacy tables |

Names are never database join keys.

Supabase is the current relational provider for operational records. It is not a second factual baseball database and does not own product rules.

## `daily_editorial_puzzles`

One row represents one editorial puzzle date and current puzzle version.

Fields include:

- stable editorial puzzle ID;
- unique puzzle date and deterministic puzzle number;
- version and optimistic revision;
- `draft`, `scheduled`, `published`, or `archived` status;
- exactly nine ordered `{slot, canonicalPlayerId, source}` selections in one JSONB value;
- creation, update, schedule, publication, and archive audit metadata.

The exact nine are stored atomically so one revision guard protects the complete lineup.

The table does not duplicate:

- player names or aliases;
- teams, positions, years, statistics, hints, or reveals;
- canonical factual enrichment;
- scoring rules;
- lineup recipe semantics;
- browser per-action state.

Approved scheduled or published IDs are joined to canonical runtime data on the server.

Current editorial puzzle numbers/dates are beta operational identity. They must not be assumed to be the eventual permanent public Daily sequence. Broad launch will explicitly establish a new permanent Daily #1 epoch; beta history is not migrated into that archive merely because it exists in this table.

## Repository and security

`apps/web/app/supabaseDailyPuzzleRepository.ts` implements the provider-neutral editorial puzzle port.

- Reads support one date and inclusive date ranges.
- Inserts require a revision-zero record.
- Updates filter by date and expected revision.
- No returned row is a conflict.
- Persisted rows are decoded before entering domain logic.
- RLS is enabled with no browser CRUD policy.
- The server service role is constructed only after editor/server authorization.
- Current editor authentication is per-request HTTP Basic over HTTPS through `/admin/auth`.
- Credentials and service-role keys remain server-only.

Completed-result persistence uses a separate provider-neutral port in `packages/daily` plus a server-only Supabase adapter in `apps/web`. The result port deliberately has different semantics from the editorial repository: one atomic first-write-wins insert keyed by `submissionId`, with no overwrite/update path. The provider inserts first and reads the existing winner only after a unique-key conflict; 4B remains responsible for deciding whether that winner is an idempotent retry or an `idempotency_conflict`.

## `daily_completed_results`

One row represents one engine-normalized completed beta game submission.

Fields are:

- `submission_id`: immutable primary/idempotency key supplied by the browser transport contract;
- `schema_version`: currently exactly schema 1;
- stable `puzzle_id`, `puzzle_date`, and `puzzle_number`;
- exact `ruleset_version` / game identity, initially `points-v3` or `classic-inning-v1`;
- ordered `completed_at_bats` JSONB containing the normalized native facts;
- engine-derived `summary` JSONB;
- provider-owned `created_at` receipt timestamp.

The table intentionally stores no account/user identity, answer names, client-trusted total, per-action event stream, or mutable gameplay state. The population index is `(puzzle_date, ruleset_version, puzzle_id)` for later same-puzzle/same-game aggregates.

Persistence/security contract:

- the production creation migration `20260917132147_create_daily_completed_results` is reconciled into source control;
- RLS is enabled and there are no `anon` or `authenticated` policies;
- `service_role` has direct `SELECT` and `INSERT` only after migration `20260918004822_harden_daily_completed_results_privileges`;
- there is no provider update, delete, truncate, or upsert path;
- the server-only row codec fails closed on malformed persisted contract rows;
- the Supabase adapter implements the existing atomic `DailyCompletedResultRepository.insertIfAbsent` port and does not validate gameplay or derive summaries.

The table/adapter is consumed only through the server completed-game POST boundary. Browser submission/retry wiring remains separate, so ordinary gameplay does not submit results until that client step lands.

## Anonymous gameplay state

At launch, ordinary gameplay is client-driven.

The browser persists compatible public state and an opaque signed token. The token authorizes progression but does not own or store the visible point total, baseball display state, answers, or reveal data.

Current browser state includes:

- puzzle identity and public initials;
- ruleset version;
- current at-bat and local UI state;
- point total, maximum, at-bats completed, and completion state;
- baseball runs/hits/outs/bases retained for legacy compatibility and possible alternate display;
- ordered spoiler-safe raw completed-at-bat facts: pitch number, initials, outcome, hints revealed, wrong guesses, and correct/strikeout/Give Up resolution;
- opaque signed progression token.

New games use `points-v3`: each at-bat starts at 7 points, each revealed hint or wrong guess deducts 1, and a third wrong guess or Give Up awards 0; nine at-bats have a 63-point maximum. Compatible `points-v2` saves retain `4/3/2/1/0.5/0` and a 36-point maximum; `points-v1` saves and signed tokens retain `5/4/3/2/1/0` and a 45-point maximum. Compatible pre-ruleset saves and signed tokens normalize to `legacy-inning-v1` so an already-started game is not silently changed from three-out completion to all-scheduled-at-bats completion.

No Redis, replay cache, durable anonymous server session, or database write per hint/guess is part of the accepted launch model.

## Beta versus permanent Daily identity

The current numbered Dailies are beta sessions. Their puzzle IDs, dates, and numbers remain valid for current beta gameplay and compatibility, but they are not the permanent archive sequence.

Before broad launch, the owner will explicitly choose a launch date. That Pacific date becomes permanent Daily #1 and establishes a new epoch; subsequent Pacific dates increment from it. The launch epoch must be configuration/data owned by the Daily domain rather than inferred from the current beta epoch or scattered through routes/React.

Once issued, a permanent Daily is a frozen historical puzzle identity with an exact ordered lineup. Later generator/profile changes must not mutate that historical lineup. Result and personal-history keys must use stable puzzle identity plus game/ruleset identity; display number or player names are not join keys.

Daily Nine and Classic Inning are distinct games that currently share a lineup. Their saves, completed results, comparison populations, and personal history remain separate. The data model must not require both games to remain enabled or to share a lineup forever.

## Browser-local scorecard answers

Schema 3 accepts an optional `scorecardAnswers` map of pitch number to terminal canonical display name alongside the game state. Missing/malformed values normalize to an empty map; only resolved/pending-terminal slots are retained. Names are not part of shared raw facts, share results, tokens, or future aggregate submissions. Existing saves remain readable with an unavailable-answer placeholder. Reset removes the map with its saved session.

## Future browser-local archive history

The first no-account archive keeps personal completion history on the browser/device. This is user convenience state, not server identity and not the source for global aggregates.

The local history contract should retain, per stable permanent Daily identity plus game/ruleset:

- completion state;
- the user's recorded completed result/summary needed to render archive history;
- enough version information to migrate or reject incompatible local schemas safely;
- no assumption that Daily Nine and Classic completion are interchangeable.

Archive gameplay must use a storage key distinct from the current Daily save so opening an old puzzle cannot overwrite today's in-progress game. A completed archived game should continue to show the user's recorded result on that browser. Replay policy beyond preserving the first recorded completion is intentionally unsettled.

Cross-device history, accounts, and server-side personal profiles are deferred. Anonymous server result rows used for aggregate comparison must not be treated as an account history system.

## Future gameplay profiles

Gameplay profiles are approved future operational data, separate from factual player records.

A profile may store:

- canonical player ID;
- Standard Daily eligibility;
- recognizability/difficulty tier;
- preferred/allowed slots;
- expert-only status;
- manual promotion/exclusion;
- editor reason/notes;
- observed solve summaries or references;
- revision and audit metadata.

The portable contract must be defined before a Supabase migration. A factual data refresh must not overwrite profiles.

## Future saved lineup recipes

A saved recipe may store:

- stable recipe ID, name, and version;
- slot groups;
- factual and gameplay-profile filters;
- repeat and diversity constraints;
- generation method;
- editor/audit metadata;
- active/inactive status.

Recipe evaluation belongs in `packages/daily`. Storage preserves structured inputs; it does not independently interpret them.

A puzzle stores its exact final nine even when a recipe generated the proposal.

## Approved Classic result identity

`classic-inning-v1` is a separate ruleset/game population using the same current beta puzzle lineup identity. Its result contains only faced at-bats, with runs/hits/outs derived from existing runner rules. Default `points-v3` remains Daily Nine; `points-v2` remains a compatibility population. Both beta games may be played; submissions and aggregates must isolate rulesets/games. Shared lineup identity is not a requirement of the future permanent model.

## Completed-game result contract and persistence boundary

Aggregate comparison will add at most one compact idempotent submission per completed game.

The implemented schema-1 `DailyCompletedResultSubmission` preserves:

- stable puzzle identity;
- ruleset/game identity;
- ordered native at-bat facts for every faced slot (nine for Daily Nine; only reached slots for Classic);
- outcome;
- hints revealed;
- wrong guesses;
- correct, K, or Give Up resolution;
- anonymous client-generated idempotency ID (`submissionId`, 1–128 ASCII letters, digits, underscores, or hyphens, preserved exactly; a UUID is accepted).

Exact transport fields are `schemaVersion`, `submissionId`, `puzzleId`, `puzzleDate`, `puzzleNumber`, `rulesetVersion`, and `completedAtBats`. Only `points-v3` and `classic-inning-v1` are accepted initially. The ruleset identifies the game independently of the puzzle ID; neither game requires the other game or its lineup to exist.

`DailyCompletedResult` adds the engine-derived, ruleset-specific `summary`. Daily Nine has points/maximum, completed/total at-bats, completion, and strikeouts. Classic has runs/hits/outs/strikeouts, completion, and completed/total at-bats. Client totals and unknown fields are discarded, not persisted as authority. No completion/receipt timestamp is created by the engine; server receipt metadata belongs to the later provider boundary.

`validateDailyCompletedResult` owns portable validation/summary derivation; its requirements and consistency-only threat boundary are in `docs/spec/engine.md`. The repository/service consumes only this normalized validated/derived record; it does not re-run scoring, completion, or puzzle validation.

`DailyCompletedResultRepository` and `createDailyCompletedResultService` implement step 4B in `packages/daily`:

- `insertIfAbsent(result)` is the sole repository write primitive;
- `submissionId` is the atomic first-write-wins key;
- provider implementations must never overwrite an existing record for that ID;
- a new ID returns the inserted complete normalized result;
- an existing ID returns the already-stored complete normalized result;
- the service compares every normalized contract field, including ordered raw at-bat facts and the derived summary;
- same ID plus the same normalized result returns the existing result as an idempotent retry;
- same ID plus any different normalized result returns `idempotency_conflict` and leaves the stored record unchanged.

The repository contract is intentionally one atomic operation rather than `get` followed by `save`, so a later provider can make concurrent retries race-safe. The service retains the full result/raw facts rather than reducing persistence input to display totals. Exact implementation scope: `tasks/plans/completed-result-repository.md`.

The relational `daily_completed_results` table plus server-only Supabase row codec/repository adapter are implemented as the provider portion of 4C. The completed-game POST API validates against the authoritative public puzzle through engine 4A and stores through 4B/provider. The browser submission client stores a separate local record keyed by stable puzzle identity plus exact ruleset/game. The record contains the exact schema-1 submission payload, one stable client-generated ID, and local `pending`/`submitted`/`conflict`/`rejected` status. It is written before network I/O; every retry reuses the exact stored payload so replay changes cannot reuse an ID with different facts. The client can retry an existing pending record without creating a new one. Native activation uses hydration-only provenance without changing the persisted gameplay-save schema. A current compatible session with explicit native facts may create one delivery record when it genuinely completes. An already-completed restored save with no delivery record does not create one retroactively. Existing pending delivery records can retry after hydration. Legacy facts reconstructed from old local pitch lines remain compatibility display data and are never used to create a new aggregate submission. There are no per-action writes.

Comparison populations are always scoped to stable puzzle identity plus exact ruleset/game identity. Daily Nine and Classic never share an aggregate population. `points-v1`, `points-v2`, and `points-v3` results also remain separate populations. Raw facts are retained so aggregates can be recalculated as presentation evolves.

Daily Nine comparison may derive per-at-bat points, whole-game score, averages, distributions, and later percentiles. Classic comparison derives baseball-native measures such as runs, hits, reached-at-bat counts/rates, and per-at-bat outcome distributions; no overall Classic percentile formula is approved yet.

Do not reuse inactive legacy attempt/result tables by default and do not introduce per-action writes.

## Inactive legacy scaffold

The original migration's database-player, original Daily, attempt/result, social, and head-to-head tables remain inactive and non-authoritative. Cleanup or migration requires a separate dependency-aware decision.

## Portable resolved-at-bat observations (4D foundation)

`DailyAtBatResultSubmission` schema 1 carries attemptId, exact puzzle ID/date/number, points-v3 and one native `atBat`. `validateDailyAtBatResult` binds that observation to caller-supplied authoritative puzzle/ruleset context, validates terminal facts through the same engine normalizer used for completed games, and derives `awardedPoints` using `getDailyAtBatPoints`. It accepts any isolated slot 1–9 without requiring earlier delivery or game completion. Classic and compatibility rulesets are not accepted by this new contract; their existing completed-result behavior is unchanged.

Normalization copies only approved fields and discards client scores, answers and timestamps. This validates internal consistency, not honest play, unique people or coherent multi-tab attempts. Idempotency and browser identity enforcement belong to subsequent layers. No repository, table, endpoint or collection activation is added here. Scope: `tasks/plans/resolved-at-bat-contract.md`; the replacement comparison roadmap is PR #175.
