# Points-v4 portable comparison domain

Status: row G2 implementation scope; pure comparison math only, not provider/browser activation  
Date: 2026-09-25

## Scope contract

- **Goal:** make Daily Nine comparison normalization correct for exact-version `points-v3` and `points-v4` populations without implying that the current Supabase provider can read/write v4 yet.
- **Owning layer:** `packages/daily`.
- **In scope:** exact-version comparison identity types, pure at-bat count/sum normalization, engine-owned score-range lookup, signed v4 AB sums, completed score-bucket normalization, offset histogram indexing, strict-lower finish rate across negative scores, focused tests, exports and canonical docs.
- **Out of scope:** shared comparison HTTP schema, Supabase result codecs/constraints/migrations/RPCs/decoders, server read acceptance, browser clients/hooks/persistence, scorecard/share presentation, archive activation and switching the public ruleset.
- **Acceptance checks:** v3 AB aggregates remain 0..7 per observation and completed histograms remain 64 entries for 0..63; v4 accepts -1..4 per AB, rejects out-of-range aggregate sums, accepts completed buckets only from -9..36, creates a 46-entry histogram where index 0 is -9 and index 45 is 36, combines duplicate buckets, derives signed averages, and computes strict-lower rates correctly for negative values and ties.
- **Stop conditions:** any need to alter a database object, Supabase adapter/decoder, HTTP/browser accepted ruleset, or public runtime becomes G3/H rather than being folded into this PR.

## Boundary decision

At G2, widening `DailyNineComparisonRepository` directly would have made the deployed Supabase implementation type-claim support for v4 while its storage/RPC/decoder boundary still rejected or mis-handled negative values. G2 therefore separated pure comparison normalization from the deployed read port. G3A later widened result storage only. G3B now widens the comparison RPCs, signed provider decoder, and Daily repository/service read port together, so the type boundary matches the hosted provider capability.

The pure identity/math layer and deployed provider/service layer now both support exact-version v3/v4 populations. The shared comparison HTTP schema and browser/server request acceptance remain points-v3-only until H, so this backend-compatible checkpoint does not activate v4 publicly.

## Histogram contract

Daily obtains the exact scoring range from the engine rather than copying scoring constants.

- points-v3 nine-AB range: 0..63, integer step 1, histogram length 64;
- points-v4 nine-AB range: -9..36, integer step 1, histogram length 46.

Histogram index is `(score - minimumScore) / step`. For v4, score -9 maps to index 0, -1 to 8, 0 to 9, and 36 to 45. Strict-lower calculations convert indices back to actual scores before comparison.

A future fractional ruleset is not implicitly supported. The comparison normalizer requires integer score steps and should be revisited explicitly if a 0.5-point policy is chosen.

## Verification

Focused Daily tests cover v3 compatibility, signed v4 at-bat aggregates, v4 lower/upper rejection, offset buckets, duplicate bucket merging, signed average, negative strict-lower/tie semantics, malformed histograms, and existing independent read behavior.

Repository CI and exact-head Preview remain required. Supabase hosted verification is not applicable because no provider, SQL, migration, privilege, or hosted-data behavior changes in G2.

## Documentation impact

Update data-model/architecture handoffs, START-HERE, todo, the September 24 roadmap, and the existing comparison design records so they distinguish version-aware portable math from the still-v3 deployed provider boundary.
