# Permanent Daily issued-clue snapshot contract

Status: bounded portable-contract step for permanent clue immutability.

## Goal

Define a provider-neutral immutable representation of exactly what a player may see before resolving each at-bat in an issued permanent Daily, so later initials/hint-generation changes cannot rewrite historical clues.

## Owning layer

`packages/daily` owns this snapshot contract because it is permanent puzzle lifecycle data, not a baseball fact, engine rule, browser concern, or provider schema.

## Frozen public clue data

One snapshot contains:

- one exact four-slot hint layout: slot, hint type, and display label;
- exactly nine ordered pitches;
- each pitch's canonical player ID and exact public initials;
- each pitch's exact four already-materialized hint values.

The snapshot has its own schema version. The shared layout is stored once rather than duplicated nine times because the current Daily puzzle contract has one hint layout for the whole puzzle.

## Deliberately not frozen

No outcome mapping, bases, points, ruleset version, or scoring values are stored in the clue snapshot. A future archived play must still use the ruleset selected when that play starts. Canonical answer/reveal identity remains the frozen canonical player ID.

## Validation

- four hint-layout slots ordered 1 through 4;
- unique supported hint types and nonempty labels;
- nine pitches ordered 1 through 9;
- unique nonempty canonical player IDs;
- nonempty public initials;
- exactly four nonempty issued hint values per pitch;
- defensive cloning at creation/copy boundaries.

## Out of scope

This PR does not attach the clue snapshot to the existing stored issued-puzzle schema, migrate Supabase, modify the row codec/repository, alter issuance composition/materialization, change initials, change scoring, create a launch epoch, expose archive UI, or insert permanent rows.

## Security and second-order effects

The snapshot contains only clues already authorized to become public during gameplay. It contains no answer display names, reveal records, search aliases, or scoring facts. Persisting it later will not make it browser-readable: existing archive storage remains service-role-only.

Because exact clue presentation is frozen while scoring is not, later clue-generation changes can affect newly issued puzzles without mutating already-issued permanent puzzles, while archived replays can still adopt a newer scoring ruleset.

## Acceptance

Focused contract tests, full repository tests/typecheck, file-size/docs gates, canonical data pipeline, production package build order, exact-head Preview, and fresh-eye review must pass. Hosted permanent storage remains untouched and empty.

## Follow-on status

This snapshot is attached to the schema-v2 issued-puzzle envelope, persisted through the append-only Supabase adapter, materialized by server issuance from the same current public clues used in gameplay, and consumed by archive materialization without rebuilding mutable clue values. The server issuance scope is `tasks/plans/permanent-daily-server-clue-issuance.md`; archive consumption scope is `tasks/plans/permanent-daily-archive-clue-materialization.md`.
