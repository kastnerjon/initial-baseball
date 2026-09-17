# Manual editorial player pool

Status: implementation scope contract  
Date: 2026-09-17

## Goal

Separate the conservative automatic Daily answer pool from the authorized manual editorial selection pool.

Automatic generation must continue using the existing `dailyEligiblePlayers` heuristics. Explicit manual editing may select a broader player only when that player is canonically resolvable and reveal-ready through the current gameplay/hint data boundary.

## In scope

- keep deterministic automatic proposal generation on the existing Daily-eligible candidate set;
- build a separate manual candidate set from the broader playable baseball-data universe, canonicalized through the current runtime identity resolver;
- hide/reject manual candidates that are not reveal-ready;
- allow authorized search, preview, slot replacement, full-lineup replacement, validation readback, and lifecycle readback to understand the broader manual pool;
- preserve existing generated-pool recognizability ranks for players already eligible for automatic generation;
- emit an explicit `outside-daily-eligible-pool` validation warning for a manually selected player whose legacy `dailyEligible` flag is false;
- keep the warning advisory: explicit scheduling remains a separate lifecycle action and is not blocked solely by this warning;
- update the lineup-content product contract and ChatOps runbook;
- add focused tests proving generation remains conservative and manual-only reveal-ready players are accepted with warnings.

## Out of scope

- changing `dailyEligiblePlayers` thresholds or baseball-data tier assignment;
- changing automatic lineup recipes, rank bands, repeat windows, or deterministic selection;
- adding database tables or migrations;
- changing public gameplay, scoring, results persistence, or archive behavior;
- adding arbitrary canonical-runtime players that lack the current playable hint/reveal data contract;
- changing published/archived immutability;
- redesigning the admin UI.

## Ownership

- baseball-data continues to own player facts and provisional generated-answer eligibility flags;
- `packages/daily` owns the portable validation warning semantics;
- `apps/web` owns composition of conservative generation candidates versus broader authorized manual candidates;
- existing Daily lifecycle services continue to own mutation and schedule state;
- Supabase remains persistence only.

## Acceptance

1. A player outside `dailyEligiblePlayers` but canonical/reveal-ready is searchable and previewable in authorized Daily administration.
2. That player can be manually saved and explicitly scheduled.
3. Validation includes `outside-daily-eligible-pool` for the manual selection.
4. The same player is never introduced into automatic draft generation merely because manual selection now permits it.
5. Unknown and non-reveal-ready players remain rejected before mutation.
6. Existing duplicate, repeat, recognizability-band, audit, optimistic-revision, and publication-lock behavior remains intact.
