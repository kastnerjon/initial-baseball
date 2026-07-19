# Initial Baseball Architecture Principles

These rules are part of the product architecture, not optional style preferences. Every pull request should preserve them.

## 1. One source of truth

Each baseball fact must have one canonical owner. Raw source files are inputs, canonical records are the normalized truth, and all downstream views must derive from those records. The reveal card, career totals, search, admin tools, and game runtime must not maintain competing copies of the same fact.

Examples:

- A player's 2004 batting season exists once in the canonical season layer.
- Career totals are derived from canonical seasons.
- The reveal card reads canonical season data rather than recalculating it.
- Display names and aliases come from canonical identity plus explicit overrides.

A pull request must not introduce a second calculation or storage location for an existing fact without documenting why the original owner is being replaced.

## 2. Everything is reproducible

Generated baseball data must be rebuildable from versioned sources, deterministic transformation code, and explicit overrides. A clean checkout should be able to regenerate the same outputs without undocumented manual steps.

Requirements:

- Generated files are never hand-edited.
- Transformation scripts are deterministic.
- Source versions and assumptions are documented.
- CI validates generated outputs or regenerates them as part of validation.
- Database imports must eventually be reproducible from the canonical pipeline.

## 3. The game does not interpret baseball facts

The baseball data layer owns identity resolution, team history, season aggregation, career aggregation, statistical calculations, and source reconciliation. The game layer owns gameplay: daily lineups, hints, guesses, scoring, streaks, and reveal timing.

The game may consume finished baseball records, but it must not parse raw source files, combine traded-player rows, calculate OPS or ERA, resolve aliases, or decide which historical record is authoritative.

## 4. Admin edits are explicit overrides

Editorial decisions must be stored separately from raw and generated data. Examples include preferred display names, recognizability tiers, excluded players, and manual lineup replacements.

Every override should contain:

- the affected entity or record;
- the overridden field or decision;
- the replacement value;
- a human-readable reason;
- optional provenance or date metadata when useful.

Regenerating canonical data must not erase intentional product decisions.

## 5. Every pull request should simplify the system

A pull request may add code while still simplifying the architecture. The standard is whether it reduces ambiguity, duplication, hidden exceptions, or competing responsibilities.

Before merge, reviewers should be able to answer:

- Where does this responsibility now live?
- Did this add or remove duplicate logic?
- Is the behavior easier to predict and test?
- Can the change be explained without relying on undocumented exceptions?

## 6. The UI formats data; it does not invent it

Web, iOS, Android, admin, and any future client should receive the same baseball meaning from the baseball-data layer. A client may choose which approved fields to show, how to arrange them, and how to adapt them to its screen size. It must not create or reinterpret baseball facts.

The UI must not:

- calculate OPS, ERA, WHIP, WAR, age, or career totals;
- combine traded-player rows or reconstruct team history;
- infer league leaders by comparing visible values;
- decide which name or abbreviation is authoritative;
- convert unknown values to zero;
- apply source-specific statistical rules independently.

Presentation-ready metadata such as explicit league-leader flags, ordered teams, display names, null values, and documented formatting units comes from the serving contract. This keeps every client consistent and prevents silent statistical differences between platforms.

## Layer boundaries

The intended dependency direction is:

```text
raw sources
  -> canonical identity and source facts
  -> canonical player-season records
  -> canonical career records
  -> serving artifacts / database tables
  -> game runtime, reveal UI, search, and admin tools
```

Editorial overrides may be applied at a documented boundary, but downstream layers must never write backward into raw or canonical generated data.

## Merge standard

A pull request is not ready to merge until:

1. Its source of truth is identified.
2. Generated behavior is reproducible.
3. Baseball logic and gameplay logic remain separated.
4. Manual decisions are represented as explicit overrides.
5. The change reduces or at least does not increase architectural ambiguity.
6. Client code formats approved data without inventing baseball meaning.
7. Relevant tests and CI checks pass.
8. The PR description explains the change in plain English in no more than three paragraphs before technical detail.