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
  "legacyPlayerId": "chadwick:example",
  "lahmanPlayerId": "example01",
  "canonicalId": "ibp_existing_id",
  "canonicalGroup": "reviewed-person-group",
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

A forced mapping asserts that the source records describe the same human. It must not be used merely because old application behavior treated two records as interchangeable.

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

## Compatibility redirects

`packages/baseball-data/data/canonical/compatibility-redirects.json` is separate from identity decisions.

A compatibility redirect preserves an explicit historical application reference when the old app record was wrong but the intended player is unambiguous. It does not claim that the old source row and the target player are the same person.

Example:

```json
{
  "legacyPlayerId": "chadwick:old-bad-reference",
  "targetLahmanPlayerId": "target01",
  "scope": "historical_daily_override",
  "reason": "The published override explicitly named the intended player.",
  "reviewedBy": "project-owner",
  "reviewedAt": "2026-07-19"
}
```

Use compatibility redirects only for persisted application references such as:

- published Daily overrides;
- migrated saved state;
- other immutable historical records.

They must not make an unsupported row searchable, selectable, statistically eligible, or part of the canonical identity's source mappings.

## Retired legacy IDs

A legacy row with no supported MLB identity and no required compatibility mapping is retired without a redirect.

Retirement means:

- it does not appear in the future search universe;
- it cannot become a Daily answer;
- its incorrect inherited stats are discarded;
- it is retained in migration reports for auditability.

A retired ID is not automatically redirected to a famous same-name player.

## Review requirements

Every non-empty decision must include:

- a specific source-backed reason;
- the reviewer;
- the review date;
- tests or an audit-report fixture covering the affected case.

Decisions should be removed only when the source data now resolves the same identity safely and removing the decision does not change the canonical ID or historical redirects.
