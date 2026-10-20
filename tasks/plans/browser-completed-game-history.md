# Browser-local completed game history — #437

## Scope contract
- Goal: A no-sign-in My Results page lists recoverable completed Daily/Archive/Classic games and their original score and per-at-bat outcomes from this browser's first-completion records.
- Owning layer: Web read-only persistence/display adapters.
- In scope: Expose existing completed-submission decoder/key builder without changing writes; enumerate only that namespace; replay validated native facts through existing engine scoring under the stored ruleset; mobile accessible list/details; navigation; regression coverage and recovery limits.
- Out of scope: New persistence, changing scoring/submission/first-attempt authority, account sync, arbitrary server history reads, current-save/practice fallback, joining by date, answer lookup, Custom server-credential history, public flags, migrations and #434.
- Acceptance: First record after replay/reset; points-v3 versus v4 original maxima; Classic early completion; exact identity/mode separation; malformed/missing/unavailable storage; no writes/network/answer leakage; mobile widths/keyboard; existing writer tests; build/typecheck/lint/file sizes; independent review; exact CI/READY Preview and production checks.
- Stop: New authority, schema, storage model or inferred variable-length contracts requires a separate versioned design. Revert read-only page/model/exports/navigation together; no migration or stored-data mutation.

## Retention audit and compatibility
The existing daily-result-submission:v1 record retains the first completed submission under exact ruleset/date/puzzle ID. Replays reuse it and local-game Reset removes a different gameplay key. Its native terminal facts support outcome/points display without answer reads. A submitted marker is browser data, not proof of honest play or unique-human identity; this page does not submit/re-admit anything.

This shipped v1 submission format belongs to the existing nine-slot Daily/Archive/Classic contract; the existing engine's completed-result validator enforces nine slots. Its adapter uses that explicit legacy contract, while UI and scores consume ruleset-specific engine maxima. Classic may finish before all slots. Unknown formats and future variable-length contracts are not inferred from a truncated fact list or today's settings. Custom 1–10 uses its separate signed server ledger and must acquire its own credential-authorized history reader later.

Older gameplay saves without a completion record, cleared storage, practice/replay saves that cannot establish the original completion, and unavailable cross-device records are not fabricated or relabeled as zero. Current-Daily and Archive IDs are never equated by date. Details display only recorded initials/outcomes and derived scores, not fetched/reconstructed player answers.

## Priority and release state
#460 and #461 are merged and exact-main production-verified at 272322ef6cae3382395a632e2759c22227cad9f2; main CI #39490352765 SUCCESS, production dpl_6pF8CxiRV7Mzrp7NHEBAHcboWktn READY, canonical routes and live search checks pass, recent error/fatal scan clear. Only draft #434 remains.

Custom live creator QA is blocked: QA service credential absent and runner stopped before requests; Vercel environment listing returned 403, firewall configuration lookup returned 404. Actual ingress/WAF and physical Safari/Chrome are unverified. Production/QA RLS and explicit service privileges remain intact, browser SELECT and budget EXECUTE denied, production issued rows zero and QA twelve prior fixtures. No public activation or production DB/config change.

## Independent review disposition
Isolate malformed Unicode puzzle IDs per record: key encoding failure increments the unreadable count and preserves valid neighboring games, while storage enumeration failure remains unavailable. Regression covers a lone UTF-16 surrogate next to a valid result. No writer/scoring/authority changes.
