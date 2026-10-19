# Initial Baseball Current Work

## October 19 â€” Team-history hint and reveal (#450)

- [ ] Remove five-team hint cap; show full chronological club stints including returns; align post-reveal chronology and mobile wrapping. Do not modify prior immutable issued hints or the underlying season datasets. Require independent review, exact-head CI, READY Preview. Scope: \`tasks/plans/team-history-hints-450.md\`.

## October 18 UTC-day creation-budget safety gate (#443)

- [ ] Install and verify the database-authoritative UTC-day claim on the private Custom creation budget RPC, and update the gated Web adapter to rehash/retry on the DB day. #443 corrects the cross-midnight digest bypass; Web integration is separately reviewed in #440. Both must pass exact CI/Preview, and public creation remains OFF pending names, mobile/WAF/privacy and hosted QA. See `tasks/plans/custom-lineup-creation-budget.md`.

## October 18 Custom creator owner-code issuance

- [ ] Mint a fresh random owner management capability for each anonymous named Custom v2 creation, save only its SHA-256 digest in the same issued-row INSERT, and return the secret once in a private no-store response. Present a copy control separated from the friend play link. Never use the creator-preview cookie as ownership evidence. Keep public creation/publishing flags OFF until independently approved.

## October 18 no-sign-in Custom creator ownership

- [ ] Stage nullable, private v2-only `owner_capability_digest` on the existing i¶»§q«^