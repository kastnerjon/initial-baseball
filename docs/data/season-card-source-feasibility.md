# Season Card Source Feasibility Audit

## Purpose

This document separates fields that Initial Baseball can implement from checked-in data today from fields that require an additional approved source. It is based on the current canonical artifacts generated from the repository's slim Lahman inputs.

## Confirmed checked-in inputs

The current canonical season pipeline is built from:

- `packages/baseball-data/data/lahman/Batting.csv`
- `packages/baseball-data/data/lahman/Pitching.csv`
- `packages/baseball-data/data/lahman/Appearances.csv`
- the canonical player universe and identity mappings

The generated artifacts confirm that these are slim source tables rather than complete Lahman tables.

## Fields confirmed implementable from current inputs

### Identity and season context

- canonical player ID
- season
- ordered team IDs from appearances
- position appearances
- primary position derived under one documented rule
- age when birth data is available from the canonical player universe

### Batting

Directly present in the current canonical facts:

- AB
- R
- H
- 2B
- 3B
- HR
- RBI
- SB
- BB
- HBP
- SF

Safely derivable when denominators and components are available:

- AVG
- total bases
- SLG

Not confirmed from the current slim batting source:

- G
- PA
- CS
- SO
- SH
- GIDP
- OBP
- OPS
- OPS+
- WAR

OBP and OPS cannot be treated as fully available until the required historical components are confirmed for every covered season.

### Pitching

Directly present in the current canonical facts:

- W
- L
- SV
- outs pitched / IP display
- H allowed
- ER
- BB allowed
- SO

Safely derivable when inputs are available:

- ERA
- WHIP
- SO/9
- BB/9
- SO/BB

Not confirmed from the current slim pitching source:

- G
- GS
- GF
- CG
- SHO
- BF
- R allowed
- HR allowed
- IBB
- HBP
- WP
- BK
- ERA+
- FIP
- WAR

Some game-count fields may be recoverable from appearances, but that must be validated against known players before being classified as canonical pitching facts.

## Awards and honors

None of the following are in the current checked-in canonical source manifest:

- All-Star selections
- MVP voting finishes
- Cy Young voting finishes
- Rookie of the Year voting finishes
- Gold Gloves
- Silver Sluggers
- Comeback Player of the Year

The contract may reserve a structured shape for these facts, but PR77 must not claim they are immediately populated. Before implementation, we need to identify a source, confirm licensing and reproducibility, map source player IDs to canonical IDs, and measure historical and recent-season coverage.

## League leaders

League-leader flags are not present in the current source artifacts. They may be derivable for some counting stats, but only after confirming:

- league membership by season;
- qualification rules for rate statistics by era;
- treatment of ties;
- treatment of traded players and multi-league seasons;
- completeness of the underlying field.

Until those checks exist, leader flags are desired output, not confirmed current-source output.

## Advanced statistics

The current inputs do not supply WAR, OPS+, ERA+, or FIP. These require one approved, reproducible, consistently defined source. Initial Baseball must not combine incompatible WAR families under one field.

## Realistic implementation plan

PR77 defines the schema and this feasibility boundary.

The next implementation PR should only populate fields classified above as confirmed direct or safe derived fields, and should publish automated coverage counts and reconciliation tests.

A separate source-integration PR should be opened only after a concrete source audit proves that the desired advanced statistics and awards are legally usable, reproducible, current enough, and mappable to the canonical player universe.

No field should be presented as complete merely because the schema contains it.