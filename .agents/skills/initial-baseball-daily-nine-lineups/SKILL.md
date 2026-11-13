---
name: initial-baseball-daily-nine-lineups
description: Generate, review, revise, and schedule Initial Baseball primary Daily Nine lineups for a requested number of future dates. Reuse or adjust the owner's editorial criteria, enforce 90-day automatic no-repeats, report the last verifiable use of manually chosen players, and preserve private draft and publication safeguards. Do not use for Custom Lineups, secondary Daily edition rollout, or gameplay/scoring changes.
---

# Initial Baseball — Daily Nine lineup editor

Use for requests such as “generate the next 10 Dailies,” “make 14 lineups using last time's criteria,” “swap one player for another,” “when was this player last used?”, and “schedule the reviewed lineups.” This is an **editorial assistant workflow**, not a second lineup generator or a source of database authority.

## 1. Recover the authoritative project state

- Repository: `kastnerjon/initial-baseball`. Read `AGENTS.md`, `docs/START-HERE.md`, `tasks/todo.md`, `docs/operations/daily-lineup-chatops.md`, `docs/product/daily-lineup-quality.md`, and the relevant portion of `docs/product/lineup-content-system.md`. Treat current GitHub, the canonical player system, and connected production editorial records as authoritative, not conversation recollections.
- For editorial operations, use the existing `packages/daily` generation/validation logic, `packages/baseball-data` identity/reveal readiness, and authenticated application lifecycle. Reuse the private Supabase-to-ChatOps transport described in the runbook if available. Never invent a new endpoint, SQL publication shortcut, player ID, or permission.
- Keep production, isolated Supabase QA, and Vercel Preview distinct. Do not enable unrelated flags, migrations, competition, or Custom features. The GitHub repository is public: **never commit or place future player rosters, hidden clues, canonical IDs for unpublished lineups, credentials, or private transport payloads in public GitHub issues, PRs, Actions, or docs**. The skill itself must contain no upcoming roster.

## 2. Establish the horizon and criteria conversationally

- If the number of dates `N` is absent, ask for it as one question. If the start date is absent, inspect the Pacific-date editorial calendar and existing scheduled/published/draft horizon; default to the next unfilled future stretch, **never overwriting existing records silently**. State the exact date range before generating. If the phrase “next N days” would include already scheduled dates, explain the coverage and choose the first N unfilled consecutive dates only when that is clearly consistent with intent; otherwise ask one precise clarification. Avoid unnecessary repeated questions.
- Before generating, ask exactly **one** criteria question: “Same criteria as last time, or different?” If the owner already answered in this request, do not re-ask. “Same” means the most recent owner-approved editorial recipe, not an assistant guess; recover it from prior conversation/project context and label it as an editorial preference rather than a shipped generator contract.
- **Last explicitly agreed editorial recipe (November 12, 2026):** a recognizable 1970s/1980s backbone, with a mix of 2000–2025 players—generally 1–3-time All-Stars—in the later slots; recognizable/easier names early, moderate difficulty in the middle, deeper but fair challenges late; some diversity of era, teams, roles, and positions. This is an *editorial preference*, not a hard automatic eligibility guarantee. If the owner changes it, reflect the new criteria for that batch. Do not claim precise All-Star counts or player recognition grades without verified data.
- **Existing portable slot-rank contract (authoritative):** slots 1–2 ranks 1–250; 3–4 ranks 251–1,000; 5–6 ranks 1,001–2,500; 7–9 ranks 2,501–5,000. Never silently replace domain rank rules with the editorial preference. Distinguish an owner-approved manual out-of-band exception from automatically eligible generated selections.

## 3. Generate and validate privately

1. Resolve every chosen player through the existing canonical resolver; require a single, approved, reveal-ready identity. Do not guess ambiguities or use display-name equality as identity proof. Automatic picks come from the ranked `dailyEligiblePlayers` stream; manual authorized picks can be outside it, with the existing warning.
2. Use the production Daily algorithm and reviewed data version where supported. Generate dates sequentially with their actual history and already-proposed selections. All lineups must have nine ordered slots, nine canonical-unique players per date, and no duplicated player across the proposed batch by default.
3. **Automatic 90-day no-repeat:** exclude any canonical player used on a previous Daily date within 1–90 calendar days of the candidate date; 91 days is eligible. Check against published, scheduled, archived, and relevant draft records and reconstructed deterministic fallback lineups for dates without editorial records. Include earlier days in the newly proposed batch. Where multiple official editions exist, consider all applicable official occurrences, not only the primary. Fail visibly if trustworthy usage coverage is insufficient; never silently widen the repeat window or player pool.
4. Apply the current validator: canonical identity, reveal readiness/hint completeness, rank-band fit, exact slot order, recent usage, and automatic-pool status. Where an editorial preference (e.g. 1–3 All-Star selections) lacks approved data, mark it unverified; do not invent facts or elevate player stats into editorial recognizability evidence.
5. Give a readable day-by-day nine-player lineup with slot order, dates/puzzle numbers, and useful flagged exceptions. Show an aggregate repeat check and any coverage gaps. These are private owner-facing previews, not public GitHub payloads.

## 4. Manual substitutions and last-use reporting

For **every** owner-proposed replacement (even if it appears safe):

- Resolve the exact canonical identity, and read the current target lineup/revision before changing anything. Check duplicates in that lineup, the proposed batch, and already booked future editions.
- Search **all supported official Daily usage sources** for the latest verified past occurrence: editorial `published` / `scheduled` / `archived`, reconstructed deterministic primary Daily for dates lacking editorial records, and any verified immutable issuance/history source. Report status and date precisely. Separately report draft reservations: a draft is not evidence the public actually played that player. Include the days between last verified use and proposed date.
- If a prior use is within 90 days, clearly warn with the exact previous date and day gap. The owner may explicitly override for a **manual** pick; do not override automatically or silently change the requested player. An unknown, ambiguous, or non-reveal-ready identity remains blocked regardless of the owner's repeat exception.
- If there is no match, say **“No prior use found in the records checked”** and describe the coverage; say “never used” only when all applicable historical sources have been reconciled and support that conclusion. Report missing historical rows and source gaps as uncertainty, not as zero usage.
- When a repeat or rank warning exists, propose a few genuinely eligible alternatives if useful, but make no substitutions without owner approval. Confirm the updated nine-player uniqueness and batch-wide 90-day checks after each edit.

## 5. Save, schedule, verify

- **Generate/review** and **save draft** and **schedule** and **publish** are distinct lifecycle steps. Do not mutate anything merely because the owner asked for proposals. Save through the **existing authorized private ChatOps/application editorial workflow** with `schedule: false` only after the owner wants drafts persisted. Do not directly `UPDATE`/`INSERT` production `daily_editorial_puzzles` through SQL or circumvent revision-CAS, authorization, audit, or server validation.
- Scheduling requires explicit owner instruction such as “schedule these” or the established editorial usage “publish these for their assigned dates.” For future puzzles this means schedule them for their respective dates, **not reveal/publish future answers immediately**. If the user explicitly requests immediate future publication, distinguish that from normal scheduling and do not do it through an unsupported path. Published/archived records remain immutable.
- Before dispatch, confirm date, exact ordered nine canonical IDs, uniqueness, current status/revision, and disposition of warnings. Never automatically replace a previously scheduled lineup or reset active gameplay; require specific owner approval for such changes. Use only the production private transport specified by the runbook, with `schedule: true` for approved future scheduling.
- After each dispatch, inspect the private HTTP response and authoritative persisted row for exact identity, slot order, revision, actor/status, and schedule metadata. A request ID, apparent HTTP success, or transport timeout alone does **not** prove completion. On timeout, read back **before** any retry. Check all dates; explicitly separate completed, failed, and blocked dates.
- Do not take a scheduled record's `published_at: null` as a failure of scheduling. Do not call scheduling publication, production release verification, or hosting QA if only scheduling completed.

## 6. Completion report and boundaries

Provide (a) date range and number of lineups, (b) criteria used, (c) repeats avoided / accepted manual overrides and last-use dates, (d) draft/scheduled/published status by date after authoritative verification, and (e) anything needing owner attention. Keep the response concise and private.

**Stop rather than improvise** when private production access is missing, canonical IDs or history cannot be verified, a transition would breach immutability, an unsupported secondary-edition issuance path is requested, or the only possible mutation would bypass the existing authenticated application workflow. Explain the precise blocker; never claim success without readback.