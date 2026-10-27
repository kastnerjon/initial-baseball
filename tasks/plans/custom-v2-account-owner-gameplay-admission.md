# Verified account-aware Custom v2 gameplay admission

Depends on PR #520: persistent, private `creator_seen` marker and database v2 admission lock.

Scope: for all v2 gameplay POST actions, verify a nonanonymous confirmed Supabase Auth user if creator authentication is enabled. Compare only server-side UUID against the private issued puzzle `creator_account_id`. If same account: return redacted `creator_preview` on bootstrap even without original creation cookie, and reject hint/resolve/submit. If valid challenge browser attempt cookie already exists, mark its row `creator_seen=true` before returning; any database failure fails closed. Preserve Auth session refresh cookies and existing attempt cookie, without logging any secrets. If different account or guest, retain unchanged guest gameplay and immutable scoring; legacy creator-cookie inspection remains active.

Tests: cross-device owner, lost creation response, old guest attempt then login as owner, owner signout, different account, guest, invalid/duplicate marker, PKCE refresh cookie coexistence, disabled Auth, misconfigured enabled Auth and private DB errors. Real hosted QA with actual providers/physical browsers and DB migration rehearsal remain required. No cookie redesign, no claims of verified-person competitive integrity.

No production flags, league schema, H2H or public Discover activation. Creator metrics must account for already-admitted attempts subsequently marked before reliable public aggregates.
