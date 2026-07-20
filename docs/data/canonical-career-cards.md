# Canonical Career Cards

## Purpose

Canonical career cards are the stable product-facing data contract between the validated baseball pipeline and future reveal, admin, search, and serving layers.

They combine identity, direct career totals, safe career-rate calculations, team history, primary position, Hall of Fame status, and references to canonical season cards. They do not read or modify legacy runtime player objects.

## Architecture gate

- **Owner:** `packages/baseball-data`.
- **Source of truth:** canonical player universe, canonical career aggregates, and canonical season cards.
- **Identity:** canonical player ID and Lahman ID only; no name joins.
- **Direction:** canonical facts → career aggregates → career cards → future serving release → clients.
- **Runtime:** this remains a shadow artifact. The live game is unchanged.

## Contract

Each card includes:

- canonical and Lahman IDs;
- display name, legal name, aliases, and Hall of Fame flag;
- player type;
- first and last covered season;
- covered season count;
- complete team-ID history;
- primary position from career appearance totals;
- direct batting and pitching career totals;
- safely derived AVG, SLG, ERA, and WHIP;
- explicit placeholders for unsupported advanced statistics and achievements;
- ordered references to each canonical season card;
- provenance flags describing which upstream records exist.

## Unsupported fields

WAR, OPS, OPS+, ERA+, FIP, awards, All-Star counts, and league-leader records remain `null` until a trusted enrichment source is added with documented coverage and reconciliation.

A null means unknown or unsupported. It must not be displayed as zero.

## Presentation boundary

The card describes what is true and available. It does not decide which metrics the interface displays, their order, labels, presets, or whether a section is visible. Those are product-configuration concerns.

This preserves the rule:

> Canonical data determines what is true. Product configuration determines what is shown.

## Outputs

The generator writes:

- `career-cards.json`;
- `canonical-career-cards-report.json`;
- `canonical-career-cards-report.md`.

## Validation

Strict generation checks:

- unique career cards;
- exact canonical/Lahman identity alignment;
- complete coverage of all players represented in upstream career or season records;
- valid career ranges;
- unique, ordered season references;
- season-reference counts;
- unsupported fields remaining null;
- representative identity and player-type regressions.

## Commands

```bash
pnpm --filter @initial-baseball/baseball-data generate:canonical-career-cards
pnpm --filter @initial-baseball/baseball-data generate:canonical-career-cards:strict
```

## Scope boundary

This phase does not enrich WAR or awards, publish a runtime serving artifact, migrate the reveal screen, or implement UI configuration. Those remain separate reversible changes.
