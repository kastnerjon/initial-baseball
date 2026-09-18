# Resolved-at-bat repository/service

Status: Implementation scope  
Date: 2026-09-18

Goal: persist an already engine-normalized AB through an atomic first-write-wins port, with identical retries accepted and conflicting facts rejected.
Owning layer: packages/daily.
In scope: repository/service types and implementation, focused tests, exports, architecture/data-model/handoff/todo updates.
Out of scope: provider/migration, API, browser coordination, comparisons, UI, scoring/validation changes and completed-result refactoring.
Acceptance: insert/retry/conflict, out-of-order independent slots, puzzle/ruleset/attempt isolation, every normalized field compared, provider failure propagation and malformed provider responses; Daily tests/typecheck/build, file-size/docs checks and CI.
Stop conditions: a new storage/authority contract, external dependency or change to gameplay must become separate work.

PR #176 is merged into main; this PR is now based directly on that merged contract. Roadmap #175 is merged; #174 remains draft.

## Architecture decision

Mirror the existing completed-result service's small explicit port, not a generic persistence framework. Engine scoring/normalization runs before this service. Providers enforce atomicity and return the winning normalized record; the service compares named fields, not JSON serialization or object identity. No network, browser or database dependency enters Daily.

The immutable key is (attemptId, puzzleId, rulesetVersion, pitchNumber). puzzleId is the stable puzzle/version identity; date/number are validated metadata and must match on retry, not create alternate keys. Uniqueness deliberately excludes schemaVersion so a version change cannot count the same observation twice. Different slots/populations remain independent; this port cannot certify a coherent run across tabs.

Provider errors propagate to the future transport for deliberate retry mapping. An inserted result different from the input, or an existing result under a different key, is a provider contract error, not a player's idempotency conflict. Conflicts return only the observation identity, not another stored payload. Browser receipt times and comparison read status are outside this immutable semantic result.
