# Custom Lineup v2 — Browser-to-HTTP integration acceptance

Status: test-only bounded PR after #420; **does not publicly activate gameplay**.

## Scope
Exercise the actual `customLineupV2BrowserTransport` decoder against the actual `handleCustomLineupV2GameplayPost` HTTP adapter, using controlled deterministic private service mocks (no hosted DB or real HTTP browser). Cover exact N=1/5/9/10 first-attempt reservation, signed clue depth, wrong-guess history, restored progress, terminal order, points-v4 4×N max, complete and duplicate submit, creator-preview eligibility, third-strike semantics and default-off flag.
- No engine, route behavior, schema, client/UI changes, new package, deployment configuration or test-only activation of production.
- No fabricated browser screenshot or production-player record. Mock state in this test is a *protocol fixture* only.
- CI/typecheck, independent review, Vercel Preview and post-merge production verification remain mandatory.

## Acceptance and limits
The two existing public-facing adapters must interoperate without accepting browser-selected scoring, leaking future player answers or exposing private completed-attempt IDs. The fixture intentionally avoids testing real signing, Supabase transaction atomicity and browser layout; those have their own units but still need QA in a flag-enabled **isolated staging** environment with rollback and explicit launch approval.

Next review order: real full-stack test fixtures (1/5/9/10), mobile physical visual QA, runtime privacy/abuse limits, creator provenance and unique-human caveats, and only then controlled public activation. Comparison/discovery/sharing remain separate.
