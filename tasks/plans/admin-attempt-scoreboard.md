# Admin attempt scoreboard

Status: implemented locally; bounded review and release verification pending

## Scope contract

**Goal:** Let the authorized owner inspect anonymous Daily Nine attempts as AB 1–9 score rows and export the displayed page to CSV without asking in chat.

**Owning layer:** `apps/web` admin reporting and its server-only Supabase read adapter.

**In scope:** Existing admin Basic authorization; `/admin/daily/attempts` and its CSV GET; exact date/puzzle/ruleset filters; bounded two-stream keyset pages; engine-derived completion-only score projection; distinct AB receipt/completion provenance; safe CSV; admin navigation; focused security, merge, pagination and export tests; canonical documentation.

**Out of scope:** Accounts/user identity, result deletion/moderation, selective correction replay (#308), result writes, schema/index migrations, public comparison aggregation, Classic scoring, archive activation or a new reporting infrastructure.

**Acceptance checks:** Authentication precedes DB reads; unauthorized exports are challenged and never disclose rows; exact identities never merge; missing is not zero; completion-only facts do not masquerade as AB receipts; seeded IDs are explicitly labeled; pagination preserves complete attempt rows; CSV matches the displayed bounded page; existing engine owns point derivation. Focused/full CI, file-size/build/answer QA, one bounded review, exact-head READY Preview, post-merge CI/production/routes/logs and read-only data checks.

**Stop conditions:** Need for a new privilege, schema/index, account contract, result write or expansion beyond one reporting concern / 12 source-test files / approximately 600 handwritten lines requires decomposition first.

## Architecture check

Existing codecs decode both result tables; existing engine calculates points; existing admin principal and server Supabase factory own authorization and credentials. Reuse them. The new report combines factual reads for one exact edition using matching attempt/submission IDs only; it makes no claim that unrelated anonymous IDs are one person. Missing AB observations may be projected from a matching completed record but are marked completion-only, never persisted. Identity selection defaults to the stored editorial lineup; explicitly supplied old/archive IDs remain selectable. Scores and timestamps stay private admin data. No database/network imports enter portable packages and no scoring formula enters React.

Read queries are bounded and run only on the admin path. Each page reads at most 451 AB rows and 51 completions, then exact-ID joins at most 50 completions and 450 AB-ID rows. Nine slots per attempt guarantee complete data for the first 50 AB IDs in database order. Separate database-ordered cursors advance 50 AB attempts and 50 completions; completion-stream rows with any AB receipt are shown only via the AB stream. This avoids applying JavaScript collation to PostgreSQL keyset cursors and lists each attempt once for stable data. At most 100 rows are displayed. CSV exports this page rather than claiming an unbounded full-history export. Live inserts/retries can change later reads; this is an operational view, not a transactional snapshot or an average calculator.

## Operational reconciliation

The owner-requested 36-point completion removal is recorded with restorable facts and exact verification in #309. Rare selective-slot replay remains nice-to-have #308. These are separate from the read-only dashboard.
