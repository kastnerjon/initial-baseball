# Lessons Learned

Add durable corrections here when product review, QA, production verification, or code review catches a mistake. Current product and architecture rules belong in canonical documents.

## Product and architecture

- Daily Inning is the only committed product. Preserve inexpensive reuse seams without building hypothetical products now.
- Decide ownership before implementation: product requirement → source → data grain → canonical owner → derived output → runtime consumer.
- Build stable sockets for facts, outcomes, policies, and persistence; keep scoring weights, difficulty thresholds, and presentation tunable.
- React renders and dispatches. It does not own baseball facts, scoring rules, lineup recipes, or persistence semantics.
- Vercel and Supabase are replaceable adapters, not product-rule owners.
- A set of review findings is not one architecture. Recover each concern in the narrowest owning layer.
- Answer leakage and adversarial cheating are different problems. Protect ordinary public boundaries without claiming tamper-proof anonymous competition.
- A signed stateless token can prevent forged later progression without per-action persistence; replay prevention is a separate decision.

## Player identity and data

- Join by canonical/source IDs, never display names.
- Canonical display names are user-facing; longer legal/source names normally remain aliases.
- Genuine same-name players remain separate and receive only necessary disambiguation.
- A source row is evidence, not automatically a playable or recognizable Daily player.
- Facts must be pinned, reproducible, and checksum-audited.
- Generated artifacts are rebuilt from reviewed sources; they are not hand-edited.
- Season facts are modeled first; career values summarize validated seasons.
- Null and zero are different.
- Do not calculate rate statistics from partially known components.
- Runtime payloads join validated facts; they do not reinterpret them.

## Lineup quality

- Statistical accomplishment is not the same as recognizability.
- A weighted counting-stat formula can rank obscure historical players above culturally recognizable stars; do not call that output a final recognizability ranking.
- Standard Daily should normally produce “I could have gotten that” on reveal. Difficulty should come from recall and hints, not arbitrary obscurity.
- Objective facts and gameplay judgments must be separate. A data refresh must not erase editorial eligibility/difficulty decisions.
- “Standard Daily” should be one versioned recipe, not the only hardcoded selector.
- Recipe filters must use precise sourced predicates; vague labels such as `era` need explicit definitions.
- The generator proposes; the editor reviews and fixes the exact nine.

## QA, documentation, and review

- Green CI is necessary but not sufficient. Inspect representative output, browser behavior, logs, and review findings.
- Documentation must describe current code, approved next direction, and verified operational state without mixing them.
- Operational work can make docs stale without a code diff. Secrets, migrations, deployments, and production QA are incomplete until the handoff is reconciled.
- A procedural documentation rule without a CI gate or post-deployment step will drift.
- `AGENTS.md` should be a map; deeper product and architecture knowledge belongs in structured canonical docs.
- Large work starts with a plan and a bounded issue-like scope.
- Codex review supplements human product judgment; it does not replace it.
- Repeated review feedback should become a test, lint, script, or durable rule.
- A browser-safe puzzle is a separate contract from the authoritative server puzzle.
- Production bundle/network inspection is part of answer-leakage QA.

## Settled product rules

- Everyone receives the same nine-player puzzle for a Daily date.
- Correct outcomes by hint depth are HR, 3B, 2B, 1B, and BB.
- Three wrong guesses or Give Up produces K.
- Standard Daily prioritizes recognizable players; only a final slot may intentionally be a true deep challenge.
- Gameplay does not call external baseball APIs live.
- Approved Baseball Reference WAR is labeled `bWAR`.
- Exact scoring weights and lineup thresholds remain versioned tuning decisions rather than permanently locked constants.
