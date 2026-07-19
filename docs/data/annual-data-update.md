# Annual Baseball Data Update

This is the operational runbook for updating Initial Baseball after an MLB season. The final one-command workflow is implemented in later migration phases; until then, sections marked **Target command** describe the required end state rather than a currently available command.

## Timing

Run the annual update only after:

- the completed season is present in the approved Lahman release;
- the selected Chadwick release is available;
- source versions and licenses have been reviewed;
- no Daily data publication is in progress.

Do not mix a partial current-season feed with a completed historical release unless the data architecture explicitly adds a separate live-season source.

## Required inputs

Record each input in the release manifest:

- source name;
- release date or version;
- source URL or repository reference;
- file checksum;
- statistics-through season;
- acquisition date;
- any source-specific notes.

The canonical pipeline must fail when required files are missing, malformed or unexpectedly empty.

## Target command

```bash
pnpm baseball-data:update --season 2026
```

The command must create a candidate release. It must not publish directly.

Expected stages:

1. Validate source files and checksums.
2. Load raw source data into staging tables.
3. Reuse existing external-ID mappings.
4. Resolve new strong-ID matches.
5. Send weak or conflicting matches to the review queue.
6. Apply persisted identity, name and editorial overrides.
7. Build structured batting, pitching, appearance and team facts.
8. Derive season totals, career totals, hints and recognizability inputs.
9. Generate search, reveal and Daily serving artifacts.
10. Compare the candidate release with the current production release.
11. Run release gates and regression tests.
12. Produce JSON and Markdown audit reports.

## Required review report

The candidate report must show:

- input versions and checksums;
- source row counts compared with the previous release;
- new and removed source records;
- new canonical players;
- identity merges, splits and redirects;
- new, changed and removed external mappings;
- changed display names;
- changed searchable aliases;
- changed debut/final years;
- changed team and position histories;
- changed career and season statistics;
- changed Daily eligibility and recognizability;
- ambiguous and excluded records;
- historical puzzles that do not resolve;
- known regression-case results.

Large expected statistical changes from adding one season should be separated from unexpected changes to completed historical seasons.

## Human review checklist

Before publication:

- Review every ambiguous identity candidate.
- Review every merge or split.
- Review every display-name change.
- Review any change to a completed historical season.
- Review every Daily-eligible player that gained or lost required hint/reveal data.
- Confirm same-name players remain separate.
- Confirm David Ortiz appears once under David Ortiz and longer forms remain aliases.
- Confirm Emmanuel Clase displays as Emmanuel Clase.
- Confirm Elly De La Cruz retains De La Cruz.
- Confirm Luis Arráez is searchable with and without the accent.
- Confirm Ken Griffey Jr. retains the suffix.
- Confirm two-way players retain batting and pitching data.
- Confirm published Daily puzzles still resolve to the same canonical players.

## Automated release gates

Publication is blocked when:

- one external ID maps to multiple active players;
- one canonical player produces multiple visible search rows;
- a same-name collision is grouped without identity evidence;
- a Daily-eligible player lacks required hints or reveal data;
- career and season facts fail reconciliation beyond documented exceptions;
- an ambiguous identity match remains auto-approved;
- generated output changes between identical runs;
- a published puzzle loses a valid player mapping;
- a source schema changes without an approved adapter update.

## Candidate testing

Run the complete repository checks:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm check:file-sizes
pnpm build
```

Run the canonical data audit and release comparison. Verify both the web preview and the generated artifacts.

Manual web smoke tests must cover:

- normal-name search;
- alias search returning the normal visible name;
- same-name player disambiguation;
- one complete Daily game;
- each hint type;
- hitter career and season reveal;
- pitcher career and season reveal;
- two-way reveal;
- a historical published puzzle;
- the footer's code build and data-season labels.

## Publication

Publication must be atomic:

1. Approve the candidate release and audit report.
2. Mark the release immutable.
3. Publish all serving artifacts from the same release ID.
4. Deploy code compatible with that data schema.
5. Verify the production footer shows the expected code build and data season.
6. Re-run known production search and reveal smoke tests.

Do not publish some artifacts from one release and others from another.

## Rollback

Every release must preserve:

- the previous release manifest;
- the previous serving artifacts;
- database migration compatibility;
- player ID redirects;
- the code commit that published it.

Rollback restores the previous code and data release together. Historical puzzles remain pinned to their original canonical player IDs and data release metadata.

## Documentation maintenance

Any change to:

- source responsibilities;
- canonical schema;
- identity matching;
- display-name precedence;
- search behavior;
- stat formulas;
- hint derivation;
- release gates;
- publication or rollback;

must update this runbook and `canonical-data-architecture.md` in the same pull request.
