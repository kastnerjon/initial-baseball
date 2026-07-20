# Lessons Learned

Add durable corrections here when product review, QA, or code review catches a mistake. Current product and architecture rules still belong in their canonical documents.

## Product and architecture

- Daily Inning is the only committed product. Preserve inexpensive portability, but do not design current work around hypothetical native or head-to-head clients.
- Decide ownership before implementation: product requirement -> source -> data grain -> canonical owner -> derived summary -> runtime consumer.
- React renders and dispatches. It does not own baseball rules, player corrections, data generation, or persistence semantics.
- Vercel is a replaceable web host. Domain, data, engine, and persistence contracts must not depend on Vercel-specific behavior.
- Provider-specific authorization storage belongs behind a web infrastructure interface; the domain service should not import a hosting vendor directly.

## Player identity

- Join player data by canonical ID and source IDs, never by display name.
- The canonical display name is what the game shows. Longer legal or source names remain aliases unless an auditable display-name decision promotes them.
- Genuine same-name players remain separate identities. Search and admin surfaces must add career years, position, or team context rather than merging them.
- A source row is evidence, not automatically a playable player.
- Redirected Daily candidates and overrides must be deduplicated by canonical ID, not by their legacy source-row IDs.
- Canonical deduplication must not silently change the deterministic hash input for already-published Daily puzzles. Preserve the established legacy ID hash and use canonical identity only as the uniqueness constraint.

## Season and career data

- Season-level facts must be modeled at the season level first. Career records summarize validated seasons; they do not become a competing source of truth.
- Null and zero are different. A known zero stays `0`; unavailable information stays `null`.
- Never calculate a rate from partially known contributing rows. If one required source-row component is missing, the affected OBP, SLG, or OPS remains `null`.
- Runtime payloads join validated records. They do not recalculate, estimate, or reinterpret baseball facts.
- Pitchers may have real batting records. Player type controls presentation; it must not erase valid underlying facts.
- A two-way presentation must show both canonical batting and pitching lines rather than choosing one and discarding the other.

## QA and review

- Green CI is necessary but not sufficient. Inspect generated reports, representative output records, and review comments before merging a data-contract PR.
- Regression fixtures should include ordinary stars, pitchers, two-way players, historical incomplete data, multi-team seasons, and genuine same-name identities.
- A post-merge review finding should be fixed in the next active data PR and reflected in canonical documentation.
- Documentation must describe current code and current intent. Remove obsolete plans rather than leaving old and new rules side by side.
- A browser-safe Daily puzzle is a separate contract from the authoritative server puzzle. Initial props contain only public initials and configuration; hints and canonical reveal records cross the network only when the action permits them.
- Daily action routes must derive pitch number, hint depth, strike count, and outs from a server-verifiable progression token. They must not trust client claims for those fields.
- A valid signature proves that a token was issued; it does not prove that the token is still current. One-time actions need bounded server-side consumption state, exact-retry idempotency, and rejection of superseded tokens.
- Production bundle inspection is part of answer-leakage QA. A test fixture imported by live client code can silently pull the legacy player universe and its answers into a browser chunk even when page props are safe.
- Canonical same-name search results must carry only their own accepted ID. Compatibility grouping by visible name belongs only to the legacy search path.
- Filter legacy Daily candidates through canonical redirect validity before deterministic selection. Missing canonical reveal data is an explicit exclusion, never a guessed identity repair.
- Incomplete legacy browser saves that cannot prove their current progression state should be invalidated rather than reconstructed with missing hints or invented authorization.
- Production data builds must start from reviewed, committed source snapshots. Remote source refresh belongs in an explicit update-and-verify workflow, not in a deployment build.

## Locked product rules

- Daily uses the same nine-player puzzle for everyone on a given date.
- Correct outcomes by revealed hints are HR, 3B, 2B, 1B, and BB for zero through four hints.
- Three strikes or Give Up produces a strikeout.
- The default lineup curve is top 250, 1,000, 2,500, and 5,000 across the nine at-bats.
- If Baseball Reference WAR is later approved, label it `bWAR`.
- Gameplay does not call external baseball APIs live.
