# Lessons Learned

Add durable corrections here when product review, QA, or code review catches a mistake. Current product and architecture rules still belong in their canonical documents.

## Product and architecture

- Daily Inning is the only committed product. Preserve inexpensive portability, but do not design current work around hypothetical native or head-to-head clients.
- Decide ownership before implementation: product requirement -> source -> data grain -> canonical owner -> derived summary -> runtime consumer.
- React renders and dispatches. It does not own baseball rules, player corrections, data generation, or persistence semantics.
- Vercel is a replaceable web host. Domain, data, engine, and persistence contracts must not depend on Vercel-specific behavior.
- A set of review findings is not one architecture. Recover each valid finding in the narrowest owning layer and make infrastructure or authority changes separate decisions.

## Player identity

- Join player data by canonical ID and source IDs, never by display name.
- The canonical display name is what the game shows. Longer legal or source names remain aliases unless an auditable display-name decision promotes them.
- Genuine same-name players remain separate identities. Search and admin surfaces must add career years, position, or team context rather than merging them.
- A source row is evidence, not automatically a playable player.
- A moving external branch is not a production input. Pin one reviewed revision and source checksums, commit the accepted identity snapshot, and verify exact regeneration separately in CI.
- Production and preview builds should materialize reviewed committed data without depending on the source host being available.
- Generated identity snapshots are updated through the source and generator workflow, never by hand-editing a shard.

## Season and career data

- Season-level facts must be modeled at the season level first. Career records summarize validated seasons; they do not become a competing source of truth.
- Null and zero are different. A known zero stays `0`; unavailable information stays `null`.
- Never calculate a rate from partially known contributing rows. If one required source-row component is missing, the affected OBP, SLG, or OPS remains `null`.
- Runtime payloads join validated records. They do not recalculate, estimate, or reinterpret baseball facts.
- Pitchers may have real batting records. Player type controls presentation; it must not erase valid underlying facts.

## QA and review

- Green CI is necessary but not sufficient. Inspect generated reports, representative output records, and review comments before merging a data-contract PR.
- Regression fixtures should include ordinary stars, pitchers, two-way players, historical incomplete data, multi-team seasons, and genuine same-name identities.
- A post-merge review finding should be fixed in the next active data PR and reflected in canonical documentation.
- Documentation must describe current code and current intent. Remove obsolete plans rather than leaving old and new rules side by side.
- A browser-safe Daily puzzle is a separate contract from the authoritative server puzzle. Initial props contain only public initials and configuration; hints and canonical reveal records cross the network only when the action permits them.
- Production bundle inspection is part of answer-leakage QA. A test fixture imported by live client code can silently pull the legacy player universe and its answers into a browser chunk even when page props are safe.
- Canonical same-name search results must carry only their own accepted ID. Compatibility grouping by visible name belongs only to the legacy search path.
- Filter legacy Daily candidates through canonical redirect validity before deterministic selection. Missing canonical reveal data is an explicit exclusion, never a guessed identity repair.

## Locked product rules

- Daily uses the same nine-player puzzle for everyone on a given date.
- Correct outcomes by revealed hints are HR, 3B, 2B, 1B, and BB for zero through four hints.
- Three strikes or Give Up produces a strikeout.
- The default lineup curve is top 250, 1,000, 2,500, and 5,000 across the nine at-bats.
- If Baseball Reference WAR is later approved, label it `bWAR`.
- Gameplay does not call external baseball APIs live.
