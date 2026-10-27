# Sticky Custom v2 creator attempt exclusion — schema + service step

Goal: avoid treating a creator's own attempt as an eligible friend result after the server has recognized their verified account. This milestone adds private durable provenance and an atomic admission guard. The next PR wires authenticated gameplay HTTP identification and monotonic marker writes; until then do NOT enable gameplay/issuance.

Owning layer: Postgres `custom_nine_attempt_states` and `admit_custom_lineup_v2_completed_attempt` RPC; private web decoder/reader and v2 admission/bootstrap services. Scoring engine remains pure.

In scope: `creator_seen boolean not null default false`, one-way trigger preventing TRUE->FALSE, v2 result-admission RPC guard inside attempt `FOR UPDATE` transaction, result read decoder respecting sticky mark, second-device signout follow-up tests. Existing v1 table/RPC semantics unchanged by default FALSE.

Out of scope: auth session lookup or marker write (next dependent PR), retroactive exclusion from existing comparison reads, public flags, production migration, creator ownership claims, client metrics, Discover/H2H.

Acceptance: legacy v1/v2 rows default false; once marked, cannot be cleared; marked completed v2 attempt rejected even if request no longer has auth session; atomic RPC protects mark/admit order; no browser grants or answer changes; exact CI, SQL review, isolated QA proof, no production activation.

Isolated QA proof (not production): migration was applied with 42 existing v2 attempts, all preserved, and then the managed migration-history version was reconciled to the committed `20261027003000` after byte-for-byte SQL comparison. Verified private RLS and service-role-only grants, monotone trigger, and v2 RPC row-lock guard. An explicit transaction set a QA attempt marker, tested that admission failed and the marker could not be cleared, then ROLLBACK preserved zero permanently marked attempts. No live provider or cross-device browser QA yet.

Risk: independently replaying an old QA/prod migration is unsafe; this additive migration requires the reviewed ownership migration to be installed and a staging rehearsal. An already admitted attempt recognized only later may still exist in historical aggregates; block public creator metrics until aggregate exclusion policy is implemented.
