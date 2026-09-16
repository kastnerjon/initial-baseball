# Beta launch/results/archive documentation scope

## Goal

Record the September 16 settled product model before completed-result implementation so future code does not accidentally treat beta numbering, shared lineups, or both beta games as permanent launch commitments.

## Owning layer

Canonical product/architecture documentation only.

## In scope

- beta numbering is disposable and permanent numbering restarts at an explicitly chosen launch Daily #1;
- Daily Nine and Classic are distinct beta games with independent saves/results/comparison/history despite sharing today's lineup;
- either game may ultimately be removed, and shared lineup is not a permanent architectural identity;
- completed results are raw-fact, idempotent, puzzle+ruleset scoped, with separate comparison populations;
- Daily Nine per-at-bat and whole-game comparison requirements;
- Classic baseball-native comparison direction without inventing an overall metric;
- permanent archive begins at launch, preserves frozen Dailies, and remembers completion locally per browser/device;
- roadmap reconciliation before implementation.

## Out of scope

- choosing the winning beta game;
- choosing launch date or final launch rules;
- implementing a feature flag to disable Classic;
- separating lineups;
- database migrations, APIs, aggregate queries, archive routes, or account identity;
- importing current beta history into the future archive.

## Acceptance checks

- product decision is explicit and internally consistent;
- canonical blueprint/architecture/handoff/todo point to the decision and no longer imply current beta numbering is permanent archive history;
- completed-result implementation remains the next bounded engineering concern after remaining physical-device QA;
- PR metadata contains the repository-required exact `## Documentation impact` section;
- documentation-impact CI passes.

## Stop conditions

Stop and request a separate product decision if documentation would require choosing the launch game, launch date, final launch ruleset, Classic ranking metric, percentile tie policy, or replay semantics.
