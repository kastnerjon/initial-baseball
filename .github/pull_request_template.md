## Plain-English summary

<!-- In no more than three paragraphs: what does this PR do, why does it matter, and what does it deliberately not change? -->

## Why now

<!-- Explain the problem and why this is the appropriate next change. -->

## Architecture check

- [ ] **One source of truth:** I identified the canonical owner of every baseball fact changed here and did not create an unexplained duplicate.
- [ ] **Reproducible:** Generated outputs can be rebuilt from versioned sources, deterministic code, and explicit overrides; no generated data was hand-edited.
- [ ] **Baseball/game separation:** Baseball interpretation remains in `packages/baseball-data`; gameplay logic remains in the game layer.
- [ ] **Explicit overrides:** Any editorial or admin decision is represented as a separate, documented override rather than a raw-data mutation.
- [ ] **Simpler system:** This PR reduces or does not increase duplicated logic, hidden exceptions, or unclear ownership.

## Architecture impact

- **Owning layer:**
- **Input layer:**
- **Output layer:**
- **Dependency impact:**
- **Canonical keys or identifiers:**
- **Null/missing-data behavior:**
- **Known source limitations:**

If the change has no architectural or data-contract impact, explain briefly why.

## Data and answer integrity

- [ ] No hidden player answer leaks through HTML, payloads, APIs, logs, or share output.
- [ ] Player identity and statistical corrections are implemented in `packages/baseball-data`, not UI code.
- [ ] Career and serving values derive from canonical season records rather than competing calculations.
- [ ] Generated artifacts were regenerated from source and normalization code rather than hand-edited.
- [ ] Any overrides introduced below include a reason.
- [ ] Not applicable; explained below.

## Validation

- [ ] Focused tests at the behavior-owning layer.
- [ ] Upstream-to-downstream reconciliation checks.
- [ ] Full test suite.
- [ ] Typecheck.
- [ ] Lint.
- [ ] Build.
- [ ] File-size check.
- [ ] Mobile web check for user-facing changes.
- [ ] Relevant canonical documentation updated.

List commands run and any checks that remain pending.

## Overrides introduced or changed

<!-- List each override and its reason, or write “None.” -->

## Scope boundaries and follow-up work

<!-- State what deliberately did not change and identify intentionally deferred work. -->
