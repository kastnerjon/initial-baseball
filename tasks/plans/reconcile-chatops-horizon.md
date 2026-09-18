# Reconcile conversational Daily lineup horizon

Status: Active scope contract  
Date: 2026-09-17

## Goal

Record the verified routine conversational Daily lineup operating state after owner-supplied future Dailies 149–151 were persisted and scheduled through the private ChatOps path.

## Owning layer

Documentation and project continuity only.

## In scope

- record that the persisted seven-day editorial horizon now covers Dailies 145–151;
- record that owner-supplied Dailies 149–151 were persisted in exact order and scheduled through the private ChatOps path;
- keep all future player names and lineup payloads out of public GitHub surfaces;
- document safe recovery when the private `pg_net` transport times out after the server has already committed the mutation;
- mark the seven-day horizon / missing-record creation verification complete;
- make clear that routine conversational lineup entry is operationally complete and no longer blocks completed-result work;
- retain timed public rollover/fallback and remaining physical/admin QA as separate open checks.

## Out of scope

- changing Daily lineups or lifecycle state;
- publishing future puzzles;
- exposing future player names or canonical IDs in GitHub;
- code, database schema, scoring, gameplay, or UI changes;
- closing unrelated hosted QA items without evidence;
- modifying or merging draft PR #161.

## Acceptance checks

- only documentation/continuity files change;
- no future player name or lineup payload appears in the diff;
- START-HERE, todo, and ChatOps runbook agree on the current operational state;
- timeout recovery forbids blind retry before authoritative readback;
- #161 decomposition remains the next bounded engineering concern;
- documentation CI and preview pass before merge.

## Stop conditions

Stop if documentation would require inventing a successful public rollover observation that has not occurred, exposing private future lineup content, or changing product/lifecycle behavior rather than recording verified operations.
