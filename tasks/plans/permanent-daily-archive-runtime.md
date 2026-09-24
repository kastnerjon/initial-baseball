# Permanent Daily archive runtime composition

Status: implemented server archive runtime boundary

## Scope contract

- **Goal:** compose the permanent archive puzzle source with the existing Daily gameplay runtime and progression-token machinery.
- **Owning layer:** `apps/web` server-only runtime composition.
- **In scope:** archive puzzle loading by date through `permanent-v1`, reuse of the existing Daily runtime, existing progression-token codec/secret, canonical legacy-ID resolution and reveal access, missing-puzzle fail-closed behavior, focused tests, and canonical documentation.
- **Out of scope:** public archive HTTP routes/navigation, launch-date/epoch configuration, browser persistence/history, result submission/comparison routing, scoring/ruleset changes, migrations, or new token formats/secrets.
- **Acceptance checks:** archive bootstrap uses the frozen permanent puzzle; signed claims bind to its permanent puzzle ID/date; existing retained rulesets can be caller-selected; not-yet-issued dates fail closed; a token cannot continue if the loaded archive puzzle identity changes.
- **Stop conditions:** needing a token-schema change, new game/scoring rule, browser persistence change, public route contract, or launch-policy decision becomes a separate PR.

## Runtime rule

`createServerPermanentDailyArchiveRuntime` reuses `createDailyRuntimeService`. The archive-specific `createPuzzle(date)` callback performs only:

1. lookup through the existing server archive puzzle source using `permanent-v1` + the requested date;
2. fail closed when no immutable permanent puzzle exists;
3. return the already-materialized `DailyPuzzle`.

All public-puzzle redaction, authorized hint bundles, signed progression claims, guess evaluation, completion rules, and puzzle-ID/date consistency checks remain in the existing Daily runtime.

## Progression token posture

Archive gameplay uses the existing Daily progression-token schema and configured secret. A new token version or second secret is unnecessary because the signed claims already include the exact permanent puzzle ID and date.

Future archive HTTP endpoints must use this archive runtime, while current Daily endpoints continue using the current Daily runtime. Cross-surface token reuse fails closed because the runtime reloads its own authoritative puzzle source and requires the signed puzzle ID/date to match.

## Deliberate next boundary

Do **not** expose archive gameplay in the browser yet. Current generic Daily local persistence is keyed primarily by puzzle date, so archive saves must be given an explicit archive/session namespace before a public archive page can safely reuse `DailyInningGame`.

Next: isolate archive browser gameplay persistence/session keys from current Daily and retained game modes without changing the current save format unnecessarily.
