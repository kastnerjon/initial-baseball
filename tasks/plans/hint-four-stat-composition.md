# Hint 4 structured stat composition

Status: bounded implementation scope for September 24, 2026.

## Goal

Make hint 4 use structured career statistics rather than the legacy preformatted `statsLine`, keep its existing compact stat subset, order that subset according to the full reveal, and include pitcher saves only when the data source supports them.

## Owning layer

`apps/web` owns the Daily gameplay adapter and presentation ordering used here. Baseball facts remain owned by `packages/baseball-data`; the preceding pitcher-saves contract PR established truthful missing-data semantics.

## In scope

- Keep hitter hint fields `HR, RBI, SB, BA, OBP`, ordered by the canonical reveal order.
- Keep pitcher hint fields `W, L, ERA, WHIP, K`, add supported `SV`, and order them as `W, L, SV, ERA, WHIP, K`.
- Reconcile the shared default stats-hint metadata to the supported compact subsets, removing unsupported bWAR and adding pitcher saves.
- Derive hint ordering from the existing reveal-order declaration while using the shared default config as the subset declaration, so metadata and presentation cannot drift silently.
- Format values from `Player.careerStats`; do not parse `Player.statsLine`.
- Preserve a sourced `SV 0`; omit `SV` when unavailable.
- Fall back to `Stats unavailable` only when no structured career line is available.
- Cover hitter, pitcher, sourced zero, unavailable saves, and legacy-string non-authority.

## Out of scope

- No new baseball facts, WAR/bWAR, OPS+, awards, or external source.
- No change to the full reveal's field set.
- No expansion of hint 4 to every reveal column.
- No initials, scoring, token, persistence, database, archive route, or clue-immutability change.

## Second- and third-order effects

This changes a live clue's wording/order and therefore puzzle difficulty. Current beta puzzle identity does not freeze clue text, so this is acceptable only as beta product evolution. Permanent issued-clue immutability remains the next prerequisite before permanent Daily #1 issuance and before the Jr/Sr initials change.

Hint values remain inside the existing authorized current-batter bundle. This PR does not widen the answer boundary or send future-batter hints.

## Acceptance checks

- Focused hint and reveal-config tests pass.
- Full repository tests/typecheck/file-size/docs gates pass.
- Canonical baseball-data pipeline and production build pass.
- Exact-head Vercel Preview is READY.
- Fresh-eye review confirms hint 4 uses structured stats, missing saves are not fabricated, no unsupported WAR appears, and no unrelated gameplay rule changed.

## Stop conditions

Split again if implementation requires a canonical-runtime schema change, a database migration, a new baseball source, or permanent clue persistence.
