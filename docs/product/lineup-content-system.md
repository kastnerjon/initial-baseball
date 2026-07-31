# Lineup Content System

Status: Approved product and architecture direction; not yet implemented  
Last updated: 2026-07-31

## Purpose

Initial Baseball needs a reusable content engine for constructing fun nine-player games from one authoritative player universe.

The product must not equate statistical accomplishment with recognizability. The current weighted counting-stat rank can place obscure historical players above modern icons and is not an acceptable long-term Standard Daily selector.

## Core product principle

Standard Daily should be difficult because the user must recall a recognizable player from initials and ordered hints.

Except for a possible final deep-challenge slot, the normal reveal reaction should be:

> I could have gotten that.

A player who was never realistically recognizable to the target baseball audience generally does not belong in Standard Daily, even if that player had a statistically significant career.

Recognizability is a product judgment informed by facts and play data. It is not identical to WAR, Hall of Fame status, longevity, or counting statistics.

## One canonical player system

The canonical player system contains objective, source-traceable facts:

- stable canonical identity and aliases;
- career and season years;
- teams and positions;
- batting and pitching facts;
- Hall of Fame status;
- approved All-Star selections and years;
- approved awards and voting data;
- approved WAR with an explicit source label such as `bWAR`;
- source provenance and data-release version;
- hint and reveal readiness.

The implementation may continue to generate optimized runtime artifacts. “One canonical system” means one authoritative fact model and update pipeline, not one giant table queried live by every page.

## Separate gameplay profiles

Gameplay judgments must remain separate from objective baseball facts.

A gameplay profile may include:

- Standard Daily eligibility;
- recognizability tier;
- estimated difficulty;
- preferred or allowed slot ranges;
- icon/core/challenge/expert-only classification;
- manual include, exclude, or promotion;
- editorial notes and reason;
- hint-quality/readiness status;
- observed solve rate and sample size once results exist.

These profiles should be editable through a provider-neutral administration boundary. Supabase may be the first persistence adapter, but React and database rows do not own the meaning of the fields.

A factual data refresh must not silently overwrite an editorial judgment, and an editorial judgment must not mutate source baseball facts.

## Lineup recipes

A lineup recipe is a versioned set of instructions for constructing nine candidates.

A recipe contains:

- name and version;
- one or more slot groups;
- eligibility filters for each group;
- gameplay-difficulty requirements;
- repeat window;
- duplicate rules;
- reveal-readiness requirements;
- optional hitter/pitcher, team, position, or era diversity constraints;
- deterministic/random seed policy;
- fallback behavior when a candidate pool is insufficient.

Example:

```text
Slots 1–4
- career/peak overlaps 2010–2020
- at least 5 approved All-Star selections
- easy or medium gameplay difficulty

Slots 5–7
- primary era 1990s or 2000s
- at least 5 approved All-Star selections
- medium gameplay difficulty

Slots 8–9
- primary era 1980s
- at least 7 approved All-Star selections
- hard gameplay difficulty
```

The technical contract must use precise filters rather than an ambiguous generic `era` field. Useful predicates may include:

- career overlaps a year range;
- at least N seasons in a year range;
- primary decade;
- debut or final season range;
- at least N career All-Star selections;
- at least N All-Star selections within a range;
- Hall of Fame status;
- team tenure or appearance;
- position/role;
- sourced WAR threshold;
- award status;
- gameplay tier or observed solve-rate range.

Filters are supported only when the canonical player system contains an approved, reproducible source.

## Standard Daily and future games

“Standard Daily” is one saved recipe with a calibrated recognizability curve. It is not a permanent hardcoded formula.

The same recipe engine may later support:

- 2000s stars;
- 1990s All-Stars;
- 50+ bWAR;
- team-specific games;
- Hall of Fame pitchers;
- award winners;
- expert historical games;
- manually curated themes;
- user-selected or user-created games.

Only Standard Daily is committed current product scope. The architecture should make future recipes inexpensive without building every future mode now.

## Editorial workflow

The generator produces a proposal, not an unquestionable final answer.

The authorized editor should be able to:

1. choose Standard Daily or another saved recipe;
2. edit slot-group filters for a particular date;
3. generate candidates;
4. see why each player qualified;
5. see difficulty, recognizability, last use, and data readiness;
6. replace any editable player;
7. rerun validation;
8. schedule the exact final nine.

The published puzzle is the exact nine selected canonical IDs. The recipe remains reusable metadata and an explanation of how the proposal was formed.

## Validation

Recipe generation and validation belong in portable Daily logic, not React or Supabase.

Validation should cover:

- exactly nine ordered slots;
- canonical uniqueness;
- repeat-window compliance;
- filter satisfaction per slot group;
- gameplay-difficulty fit;
- required hint/reveal data;
- pool insufficiency;
- optional diversity constraints;
- explainable generated/manual source.

The admin UI renders the validation result and dispatches actions.

## Learning from play

Completed-game data should eventually estimate real difficulty:

- initials-only solve rate;
- solve rate after each hint;
- total solve rate;
- K and Give Up rate;
- average score contribution;
- slot context;
- sample size.

Observed data should inform editorial profiles and recipe calibration, not automatically rewrite them. Poor performance may result from weak hints, a small sample, or lineup context.

## Implementation sequence

1. Define gameplay-profile and recipe contracts.
2. Establish a conservative provisional Standard Daily recipe/pool.
3. Inspect generated lineups across representative dates.
4. Add approved factual enrichment such as All-Star selections and bWAR.
5. Add provider-neutral profile/recipe persistence and administration.
6. Use completed-game data to calibrate difficulty.
7. Expose optional themed/custom modes only after Standard Daily is dependable.
