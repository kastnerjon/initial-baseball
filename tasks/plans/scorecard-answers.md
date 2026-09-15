# Private scorecard and spoiler-safe sharing

Status: Implementation scope, approved September 15, 2026.

- **Goal:** show initials, the resolved canonical answer, and outcome in the scorecard; copy only spoiler-safe text from the share card's upper-right button.
- **Owning layer:** `apps/web`, including browser-only recap persistence.
- **In scope:** scorecard rendering, separate share card/clipboard interaction, retaining terminal display names through refresh/reset, focused tests, responsive browser QA, blueprint/architecture/data-model/handoff/todo.
- **Out of scope:** engine/scoring, mode implementation, server authority, answer APIs, editorial puzzles, hosting, databases, aggregates.
- **Acceptance:** resolved correct/K/Give Up names and outcomes; no unplayed answers; old saves degrade to Answer unavailable; pending/final refresh retains names; copy success/failure feedback; clipboard matches engine share text with no names; phone/tablet/desktop layout; typecheck/tests/file-size/data/build and hidden-answer gates.
- **Stop conditions:** fetching missing historical answers or changing domain/result contracts is separate work. No new dependencies. Decompose above 12 handwritten source/test files or 600 net handwritten lines.

## Architecture decision

The existing terminal response already includes the canonical display name. Keep a small web-local map keyed by pitch number alongside the saved session. This additive optional field is the persistence change explicitly needed by the approved recap behavior; it does not change token, database, portable raw-fact, or share contracts. Validate restored names against actually resolved slots. Never derive an answer from a query or bundle. Old saves cannot recover names they never recorded; show a truthful placeholder. Presentation receives names separately from spoiler-safe result facts.

Classic is a separate approved follow-up: Daily Nine defaults to points-v2; Classic Inning uses a new classic-inning-v1, same daily lineup, runs/runner rules, three outs or nine at-bats, isolated mode saves, mode-labelled results. Compatibility identifiers remain unchanged. See the separate Classic scope before implementing it.

## Verification before PR

Focused recap/storage/render tests: 22 passed. Full monorepo typecheck/tests and file-size gate passed. Canonical runtime generation completed with zero critical issues. Production web build and hidden-answer QA passed with a local test-only progression secret (2 initial payloads, 21 client chunks). The first build correctly refused a missing production secret; no hosted settings were changed. Bounded source/React review preserved terminal-only capture, normalization before recap restoration, separate sharing inputs, keyboard access, and failure feedback. Exact-preview interaction/mobile checks remain pending; physical-device latency and authenticated admin QA remain separate open gates.
