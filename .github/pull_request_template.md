## Summary

Describe the user-visible or internal behavior changed.

## Why

Explain the problem and why this is the appropriate change now.

## Architecture impact

- **Owning layer:**
- **Dependency impact:**
- **Boundary check:**
- **Duplication check:**
- **Documentation impact:**
- **Portability impact:**

If the change has no architectural impact, explain briefly why ownership and dependency direction remain unchanged.

## Data and answer integrity

- [ ] No hidden player answer leaks through HTML, payloads, APIs, logs, or share output.
- [ ] Player identity/data corrections are implemented in `packages/baseball-data`, not UI code.
- [ ] Generated artifacts were regenerated from source/normalization rather than hand-edited.
- [ ] Not applicable; explain why.

## Verification

- [ ] Focused tests at the behavior-owning layer.
- [ ] Full test suite.
- [ ] Typecheck.
- [ ] Lint.
- [ ] Build.
- [ ] File-size check.
- [ ] Mobile web check for user-facing changes.
- [ ] Relevant canonical documentation updated.

List commands run and any checks that remain pending.

## Scope boundaries

State what deliberately did not change. This helps prevent accidental coupling and makes review easier.
