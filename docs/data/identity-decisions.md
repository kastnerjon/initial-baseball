# Canonical Identity Decisions

`packages/baseball-data/data/canonical/identity-decisions.json` is the durable, reviewed exception layer for canonical player identity.

The generated player and redirect artifacts are outputs. They are not edited directly.

## Default automatic behavior

The identity generator builds a graph containing current legacy player rows and Lahman people.

Automatic identity links are limited to strong identifiers:

- Chadwick UUID;
- Baseball-Reference ID;
- Retrosheet ID;
- MLBAM ID between Chadwick rows;
- exact Baseball-Reference or Retrosheet links to Lahman.

Names and career years never merge records automatically. They only create review candidates.

A component containing exactly one Lahman player may become an approved canonical identity. A component containing multiple Lahman players is quarantined as a critical conflict and its legacy rows remain separate review candidates.

## `forcedMappings`

Use a forced mapping only after reviewing source evidence.

```json
{
  "legacyPlayerId": "chadwick:0fa4c972",
  "lahmanPlayerId": "ortizda01",
  "canonicalId": "ibp_existing_id",
  "canonicalGroup": "david-ortiz",
  "reason": "Reviewed duplicate source identities",
  "reviewedBy": "editor name",
  "reviewedAt": "2026-07-19"
}
```

Fields:

- `legacyPlayerId` identifies the current app record being reviewed.
- `lahmanPlayerId` adds a reviewed link to a Lahman player.
- `canonicalId` preserves or forces a specific Initial Baseball ID.
- `canonicalGroup` joins several reviewed legacy rows even when no Lahman mapping is available.
- `reason`, `reviewedBy`, and `reviewedAt` provide the audit trail.

At least one of `lahmanPlayerId`, `canonicalId`, or `canonicalGroup` should be present.

## `blockedLinks`

Use a blocked link when a source identifier is known to be attached incorrectly to one legacy row.

```json
{
  "legacyPlayerId": "chadwick:example",
  "source": "bbref",
  "externalId": "wrongid01",
  "reason": "Identifier belongs to a different same-name player",
  "reviewedBy": "editor name",
  "reviewedAt": "2026-07-19"
}
```

Supported link sources currently include:

- `chadwick_uuid`;
- `bbref`;
- `retro`;
- `mlbam`.

Blocking a link does not invent a replacement. The record remains in review until positive identity evidence is supplied.

## `displayNameOverrides`

Display-name overrides are keyed by stable canonical ID, not by mutable source name.

```json
{
  "canonicalId": "ibp_existing_id",
  "displayName": "David Ortiz",
  "reason": "Approved baseball-facing name",
  "reviewedBy": "editor name",
  "reviewedAt": "2026-07-19"
}
```

Display-name overrides do not merge identities. Identity must be resolved first.

## Review requirements

Every non-empty decision must include:

- a specific source-backed reason;
- the reviewer;
- the review date;
- tests or an audit-report fixture covering the affected case.

Decisions should be removed only when the source data now resolves the same identity safely and removing the decision does not change the canonical ID or historical redirects.
