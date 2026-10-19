# Player data quality and canonical identity

Status: Living source of truth
Last updated: 2026-07-20

## Goal

Daily Inning must present one understandable, trustworthy representation of each real player. Source datasets contain duplicate identifiers, formal legal names, middle names, spelling variants, accents, same-name people, incomplete historical fields, multi-team seasons, and conflicting records. Those source irregularities must not leak directly into lineup selection, search, hints, or reveal cards.

## Canonical identity model

Each accepted player has:

- one stable internal canonical `playerId`;
- one Lahman player identifier;
- one user-facing `displayName`;
- zero or more searchable aliases;
- linked source identifiers and provenance;
- zero or more canonical regular-season records;
- at most one canonical career card and runtime reveal record.

A source row is evidence for a player. It is not automatically a separate playable player.

Canonical records are joined through canonical and source IDs. Display names are never join keys.

## Reviewed source and reproducibility policy

Canonical identity production is based on a committed, reviewed snapshot rather than a moving external branch.

- `packages/baseball-data/data/canonical/chadwick-source.json` records one reviewed Chadwick commit and expected source checksums.
- `packages/baseball-data/data/canonical/identity-snapshot/` contains the accepted canonical identities and disposition recommendations, split into¶»§q«^