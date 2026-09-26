# Points-v4 portable comparison domain

Status: row G2 implementation scope; pure comparison math only, not provider/browser activation  
Date: 2026-09-25

> September 26 follow-up: the exact-version comparison architecture is retained, but inactive v4 was redefined before activation to a nonnegative 0.5-point domain. The integer/signed assumptions below are superseded by `tasks/plans/points-v4-half-walk-zero-strikeout.md` where updated.

## Scope contract

- **Goal:** make Daily Nine comparison normalization correct for exact-version `points-v3` and `points-v4` populations without implying that the current Supabase provider can read/write v4 yet.
- **Owning layer:** `packages/daily`.
- **In scope:** exact-version comparison identity types, pure at-bat count/sum normalization, engine-owned score-range lookup, half-point v4 AB sums, completed score-bucket normalization, score-step histogram indexing, strict-lower finish rate across fractional scores, focused tests, exports and canonical docs.
- **Out of scope:** shared comparison HTTP schema, Supabase result codecs/constraints/migrations/RPCs/decoders, server read acceptance, browser clients/hooks/persistence, scorecard/share presentation, archive activation and switching the public ruleset.
- **Acceptance checks:** v3 AB aggregates remain 0..7 per observation and completed histograms remain 64 entries for 0..63; v4 accepts 0..4 per AB in 0.5-point steps, rejects out-of-range or misaligned aggregate sums, accepts completed buckets only from 0..36 in 0.5-point steps, creates a 73-entry histogram where index 0 is 0 and index 72 is 36, combines duplicate buckets, derives fractional averages, and computes strict-lower rates correctly for half-point values and ties.
- **Stop conditions:** any need to alter a database object, Supabase adapter/decoder, HTTP/browser accepted ruleset, or public runtime becomes G3/H rather than being folded into this PR.

## Boundary decision

At G2, widening `DailyNineComparisonRepository` directly would have made the deployed Supabase implementation type-claim support for v4 while its storage/RPC/decoder boundary still could not yet truthfully serve the then-defined v4 point domain. G2 therefore separated pure comparison normalization from the deployed read port. G3A later widened result storage only. G3B now widens the comparison RPCs, version-aware provider decoder, and Daily repository/service read port together, so the type boundary matches the hosted provider capability.

The pure identity/math layer and deployed provider/service layer now both support exact-version v3/v4 populations. The shared comparison HTTP schema and browser/server request acceptance remain points-v3-only until H, so this backend-compatible checkpoint does not activate v4 publicly.

## Histogram contract

Daily obtains the exact scoring range from the engine rather than copying scoring constants.

- points-v3 nine-AB range: 0..63, integer step 1, histogram length 64;
- points-v4 nine-AB range: 0..36, 0.5-point step, histogram length 73.

Histogram index is `(score - minimumScore) / step`. For v4, score 0 maps to index 0, 0.5 to 1, 1 to 2, and 36 to 72. Strict-lower calculations convert indices back to actual scores before comparison.

The comparison normalizer supports the explicit engine-owned steps used by current comparison versions: v3 step 1 and v4 step 0.5. It does not infer arbitrary future fractional scoring; another score step still requires deliberate versioned support.

## Verification

Focused Daily tests cover v3 compatibility, half-point v4 at-bat aggregates, v4 range/step rejection, step-aware buckets, duplicate bucket merging, fractional average, half-point strict-lower/tie semantics, malformed histograms, and existing independent read behavior.

Repository CI and exact-head Preview remain required. Supabase hosted verification is not applicable because no provider, SQL, migration, privilege, or hosted-data behavior changes in G2.

## Documentation impact

Update data-model/architecture handoffs, START-HERE, todo, the September 24 roadmap, and the existing comparison design records so they distinguish version-aware portable math from the still-v3 deployed provider boundary.
