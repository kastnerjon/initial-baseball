# Archive-beta browser comparisons

Status: implementation complete; exact review/release evidence is recorded in the implementing PR.

## Scope contract

- **Goal:** playable issued archive-beta Daily Nine games display exact-puzzle/exact-ruleset per-AB and final AVG/BEAT using the existing filtered comparison reads.
- **Owning layer:** apps/web browser transport and gameplay presentation composition. Portable Daily comparison math remains unchanged.
- **In scope:** transmit explicit archive puzzle ID on both comparison GETs; activate shared comparison hooks/scoreboard for archive; preserve hydrated request start, durable original-result exclusion, reset and request fencing; focused tests and canonical docs.
- **Out of scope:** result writes, scoring, persistence architecture, database/schema/privileges, archive history/replay policy, permanent archive activation/launch epoch, Classic, visual redesign, accounts, caches and frameworks.
- **Acceptance checks:** archive ID/date/number/ruleset/exclusion survive transport and decoding; same-date Daily or another archive response fails identity verification; shared one-other-result, strict-lower ties and above-average status remain intact; zero/error/loading stay nonblocking; reset keeps original exclusion; current-Daily date-only transport and unsupported-game behavior unchanged. Run focused/full tests, typecheck/lint, file-size/whitespace/docs gates, strict runtime data pipeline, production build/answer scan, mobile-size browser checks, bounded exact-head review, CI and READY Preview.
- **Stop conditions:** a new identity/persistence/authority contract, schema/write requirement, unsupported archive ruleset policy, more than 12 handwritten source/test files or roughly 600 net lines. Record separate work rather than expand this PR.

## Architecture and effects

The server already validates explicit puzzleId against authoritative issued archive metadata. Browser routing must send the archive identity rather than reading same-date current Daily. Reuse existing archive classification, response identity verification, request controllers, per-slot cache and presentation. Current-Daily date-only routing remains compatible. Server authority still rejects unissued/mismatched/unsupported identities; archive rendering never issues puzzles.

Existing persistence supplies a puzzle/ruleset-scoped durable first attempt ID, including after reset. No new identity or writes are needed. Comparisons remain submitted-result populations, independent for AB/completion, with one other result sufficient and zero unavailable. Daily owns strict-lower math; ties stay in the denominator and average ties remain negative status. Existing accessible status and styling are reused without a layout change. Sharing remains spoiler-safe.

## Starting checkpoint

2026-10-07: main `0dd1de9c6c548e24b804d714174f99236a209ede`, push CI #1087 passed, canonical production `dpl_9vakHGxJkDLnwvySLFaz9Ko6ST8c` READY, no open PRs. Supabase ACTIVE_HEALTHY with three archive-beta issues and no permanent issues; filtered comparison RPCs SECURITY INVOKER, service-role executable only. Prior #303 server activation and #319 comparison presentation are reused.

## Local verification

63 focused comparisons/lifecycle/presentation tests passed. Full workspace tests passed, including 773 web tests across 108 files. Typecheck, lint, file-size, whitespace and documentation-gate tests passed. Strict runtime data generation, exhaustive season-card QA and 13,620-player runtime consumer QA passed. Production web build and hidden-answer scan passed (two initial payloads and 34 client chunks).

The first test run lacked local generated pitcher saves; the existing data build regenerated it and the full suite then passed. The first web build lacked the CI-only progression secret; the final build used the existing CI test setting and passed. No quality gate was changed. Generated saves/Next configuration changes were excluded from the commit. No layout/CSS change; physical phone/tablet interaction remains separate QA. Live browser/read proof and exact-head CI/Preview/production evidence belong to the implementing PR.

The bounded fresh-eyes review found remaining current-tense archive-disabled clauses in the canonical architecture and product blueprint. Reconciled those clauses and the related server-read paragraph in scope; runtime code is unchanged from the reviewed implementation.
