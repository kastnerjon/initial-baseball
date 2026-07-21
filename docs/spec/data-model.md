# Data Model Spec

Status: Current Daily Inning persistence contract
Last updated: 2026-07-21

Initial Baseball currently has one committed product: the anonymous, browser-first Daily Inning game. Supabase-hosted Postgres is the selected relational provider for editorial puzzle persistence, but database tables do not own baseball facts, game rules, lineup generation, lifecycle transitions, or anonymous per-action gameplay state.

The broad head-to-head, social, database-player, and original Daily tables in `supabase/migrations/000001_initial_schema.sql` are inactive scaffold from an earlier product direction. They remain committed for now, but current Daily work must not treat them as authoritative or extend them without a separate migration/deprecation decision.

## Current sources of truth

| Concern | Current authority |
|---|---|
| Player identity, aliases, teams, season and career facts, hints, and reveal data | Committed/generated artifacts in `packages/baseball-data` |
| Baseball scoring and game transitions | `packages/engine` |
| Daily generation, validation, lifecycle, and repository contract | `packages/daily` |
| Anonymous in-progress game state | Browser state plus the signed stateless progression token |
| Future puzzle editorial persistence | `public.daily_editorial_puzzles` through `DailyPuzzleRepository` |

Names are never database join keys. Editorial persistence stores canonical player IDs and joins current baseball facts from the canonical runtime when an admin view is built.

## `daily_editorial_puzzles`

One row represents one editorial puzzle date and one current puzzle version.

| Column | Meaning |
|---|---|
| `id` | Stable editorial puzzle ID supplied by the portable lifecycle service. |
| `puzzle_date` | Unique Daily date. |
| `puzzle_number` | Unique deterministic puzzle number for the date. |
| `version` | Explicit puzzle version. Versioning beyond ordinary lifecycle edits is a separate future decision. |
| `revision` | Optimistic concurrency revision. Creates begin at zero; each accepted mutation increments by one. |
| `status` | `draft`, `scheduled`, `published`, or `archived`. |
| `selections` | Exactly nine ordered `{slot, canonicalPlayerId, source}` objects stored as JSONB. |
| `created_at`, `created_by` | Creation audit metadata supplied by the authorized adapter. |
| `updated_at`, `updated_by` | Most recent mutation audit metadata. |
| `scheduled_at`, `scheduled_by` | Scheduling approval metadata. |
| `published_at`, `published_by` | Publication metadata. |
| `archived_at`, `archived_by` | Archival metadata. |

The fixed nine selections are stored together because the repository contract saves one puzzle atomically. This avoids a provider-specific transaction or RPC for ordinary slot replacement while preserving one revision guard for the complete lineup.

The table does **not** store:

- player names or aliases;
- teams, positions, or career years;
- statistics, hints, initials, or reveal cards;
- recognizability rankings;
- browser attempts or per-guess events.

Those values remain in their existing owners and are joined or derived by application services.

## Repository and concurrency rules

`apps/web/app/supabaseDailyPuzzleRepository.ts` implements the provider-neutral `DailyPuzzleRepository`.

- Reads support one date and an inclusive date range.
- Inserts require `expectedRevision: null` and a revision-zero record.
- Updates filter by both `puzzle_date` and the caller's expected revision.
- An update returning no row is a lost-update conflict, not a silent success.
- Unique-date insertion failures are repository conflicts.
- Immutable puzzle identity, date, number, version, and creation audit fields are not rewritten during ordinary updates.
- Persisted rows are decoded and validated before entering portable application code.

Supabase provides storage and atomic compare-and-swap filtering only. Lifecycle transitions remain defined and tested in `packages/daily`.

## RLS and authorization posture

Row-level security is enabled on `daily_editorial_puzzles` with no `anon` or `authenticated` browser policy.

Until the admin authentication decision is made:

- only a server-side Supabase service-role client may access this table;
- the service-role key must never enter browser bundles, public environment variables, serialized props, or client components;
- routes or server actions must authenticate and authorize an editor before calling the repository;
- React components must receive formatted application-service results rather than a Supabase client.

The exact admin authentication mechanism remains open and must be settled before the repository is exposed through a web workflow.

## Inactive legacy scaffold

The original migration contains tables including:

- `players`, `player_aliases`, and `player_career_stats`;
- head-to-head `games`, `at_bats`, events, chat, matchmaking, leagues, and moderation tables;
- `anonymous_players`, `daily_puzzles`, `daily_puzzle_pitches`, `daily_attempts`, and `daily_pitch_results`.

These tables do not back the current Daily runtime or editorial repository. In particular:

- legacy `daily_puzzles` has an incompatible UUID/`hint_config` shape;
- legacy `daily_puzzle_pitches` references database player UUIDs rather than current canonical baseball-data IDs;
- legacy attempt/result tables imply durable per-play persistence that the accepted anonymous launch model does not use.

The new editorial adapter therefore uses the distinct `daily_editorial_puzzles` table rather than destructively altering legacy foreign-key relationships. Removal or migration of inactive scaffold is separate cleanup and must not be bundled into the administration workflow.

## Future completed-game results

Aggregate field comparison may later add one compact, idempotent completed-game submission. Its raw outcome contract and table design are not settled in this document yet. Do not reuse the inactive legacy attempt/result tables by default or introduce a write for every hint, guess, or base transition.
