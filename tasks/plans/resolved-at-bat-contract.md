# Portable resolved-at-bat contract

Status: Implementation scope  
Date: 2026-09-18

Goal: validate one native points-v3 terminal AB against authoritative puzzle context and derive its awarded points without requiring game completion.
Owning layer: engine; shared supplies its portable transport types.
In scope: schema-1 AB types, pure validator, shared terminal-fact normalization extracted from completed-result validation, exports, regression tests and canonical contract docs.
Out of scope: repository, database, API, browser identity/coordination, receipts, comparisons and UI. Replacement roadmap is PR #175; this branch starts independently from main.
Acceptance: isolated slots including AB9, native correct/K/Give Up consistency, malformed identity/schema/ruleset/facts, ignored client scores/answers, detached normalization, existing completed-result regression tests, package checks and documentation-impact check.
Stop conditions: changes to completed-result semantics, scoring rules, authority or browser/storage behavior require separate scope.
Architecture: engine depends only on shared; reuse getGuessOutcome and getDailyAtBatPoints. Extract existing single-fact validation rather than copy it. No proof of honest play or previous slot participation is implied. Identity/idempotency is only represented here; its enforcement belongs to later repository/browser concerns.
