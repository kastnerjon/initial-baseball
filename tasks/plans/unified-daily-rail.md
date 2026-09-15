# Unified Daily content rail

Status: Approved UI scope, September 15, 2026.

## Goal

Keep every primary Daily surface on the same desktop width and make scorecard rows read as one compact left-aligned result.

## Owning layer

`apps/web` presentation CSS.

## In scope

- Use the existing 960px reveal/statistics width as the maximum rail for the masthead, scorebug, active card, scorecard, share card, and footer.
- Keep the rail fluid at narrower viewport sizes.
- Let child surfaces inherit the outer rail width; do not introduce a second desktop width token.
- Align scorecard initials, canonical answer, and outcome in compact columns starting at the left edge.
- Reconcile the canonical visual contract and active handoff documents.

## Out of scope

Gameplay, scoring, reveal data, persistence, sharing content, component ownership, and hosting configuration.

## Acceptance checks

- Desktop surfaces share the same left and right edges.
- Scorecard fields remain column-aligned without pushing the outcome to the far edge.
- Common phone widths retain readable rows without horizontal page overflow.
- Typecheck, repository tests, file-size checks, documentation impact, and production build pass.

## Stop conditions

Any change to component structure, game behavior, data contracts, persistence, or answer authority requires separate scope.
