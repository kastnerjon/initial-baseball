# Display-name autocomplete relevance

## Scope contract
- Goal: Daily and Custom creator autocomplete no longer suggest Chase Utley for Cam u through the undisplayed Chase Cameron Utley alias.
- Owning layer: engine shared player search relevance.
- In scope: Alternate-field multiword prefix anchor, real indexed Chase fixture, adjacent alias/name/initials cases, shared HTTP search regression; canonical search policy docs.
- Out of scope: Fuzzy matching, alias/data removal, guess evaluation, scoring, identity merging, UI layout, quotas, frozen puzzle contracts and activation.
- Acceptance: Engine and actual-engine route regressions; workspace test/typecheck/lint/file-size checks, production build/hidden-answer QA; independent review; exact-head CI/READY Preview; exact-main production and live Cam u API check.
- Stop/rollback: Any source identity, scoring or persistence change is separate. Revert the pure relevance guard; no migration.

## Reproduction and policy
Live #460 Preview search for Cam u returned only Chase Utley. The actual canonical index has displayName Chase Utley and alias Chase Cameron Utley. Ordered-token matching skipped Chase and matched Cam to Cameron, u to Utley.

Displayed names retain ordinary matching and rank ahead of alternate fields. A multiword query against fullName/aliases must prefix the alternate field's first token; it may then use existing ordered token prefixes. This keeps legal names available when searched from their beginning, while avoiding middle-name-plus-surname fragments. Single-word alternate-name searches retain existing matching (including Papi inside Big Papi). No edit distance or arbitrary character threshold is added. Initials-only rejection still happens before all matching; distinct same-name players remain distinct.

Daily AtBatCard and both Custom gameplay/creator use /api/players/search, which delegates to this engine. The API regression uses real engine behavior and a source-faithful canonical candidate; it does not mock search output.
