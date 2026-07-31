# Data Model Spec

Status: Current persistence contract and approved next entities  
Last updated: 2026-07-31

## Ownership

| Concern | Authority |
|---|---|
| Canonical identity, aliases, teams, seasons, career facts, enrichment, hints, and reveals | Versioned artifacts and source pipeline in `packages/baseball-data` |
| Outcomes, scoring, completion, and runner rules | `packages/engine` |
| Lineup profiles/recipes, generation, validation, lifecycle, and repository contracts | `packages/daily` |
| Anonymous in-progress visible state | Browser state plus opaque signed progression authorization |
| Editorial future/past puzzle records | `public.daily_editorial_puzzles` through `DailyPuzzleRepository` |
| Future gameplay profiles, saved recipes, and completed results | Separate provider-neutral contracts and migrations, not legacy tables |

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

## Repository and security

`apps/web/app/supabaseDailyPuzzleRepository.ts` implements the provider-neutral port.

- Reads support one date and inclusive date ranges.
- Inserts require a revision-zero record.
- Updates filter by date and expected revision.
- No returned row is a conflict.
- Persisted rows are decoded before entering domain logic.
- RLS is enabled with no browser CRUD policy.
- The server service role is constructed only after editor/server authorization.
- Current editor authentication is per-request HTTP Basic over HTTPS through `/admin/auth`.
- Credentials and service-role keys remain server-only.

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

New games use `points-v1`. Compatible pre-ruleset schema-3 saves and signed tokens normalize to `legacy-inning-v1` so an already-started game is not silently changed from three-out completion to all-scheduled-at-bats completion.

No Redis, replay cache, durable anonymous server session, or database write per hint/guess is part of the accepted launch model.

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

## Future completed-game results

Aggregate comparison will add at most one compact idempotent submission per completed game.

The future raw contract should preserve:

- puzzle identity;
- ruleset version;
- nine ordered native at-bat facts;
- outcome;
- hints revealed;
- wrong guesses;
- correct, K, or Give Up resolution;
- derived score for convenience;
- anonymous idempotency key;
- completion timestamp/server receipt metadata as needed.

The browser now records the native raw facts needed to form that later submission. No relational results table or submission API exists yet. Legacy facts reconstructed from old local pitch lines are compatibility display data and should not be treated as analytics-quality native submissions without an explicit migration rule.

Percentiles compare the same puzzle and ruleset version. Raw facts are retained so formulas and aggregates can be recalculated.

Do not reuse inactive legacy attempt/result tables by default and do not introduce per-action writes.

## Inactive legacy scaffold

The original migration's database-player, original Daily, attempt/result, social, and head-to-head tables remain inactive and non-authoritative. Cleanup or migration requires a separate dependency-aware decision.
